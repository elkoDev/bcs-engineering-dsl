import { expandToNode, joinToNode, toString } from "langium/generate";
import * as fs from "node:fs";
import * as path from "node:path";
import { InstanceManager } from "./instance-manager.js";
import { StatementConverter } from "./statement-converter.js";
import { ExpressionConverter } from "./expression-converter.js";
import { HardwareProcessor } from "./hardware-processor.js";
import {
  EmittedVarDecl,
  HardwareDatapoint,
  AfterStmtInstanceInfo,
} from "../models/types.js";
import {
  detectDaliComType,
  extractControlUnits,
  ScheduledControlUnit,
  ConditionalControlUnit,
  RegularControlUnit,
} from "../utils.js";
import { TypeConverter } from "./type-converter.js";
import {
  HardwareModel,
  ControlModel,
  Statement,
  Expr,
  isControlUnit,
  isVarDecl,
  ControlUnit,
} from "../../../../language/generated/ast.js";

/**
 * Handles special input mapping and constructor logic libraries (e.g., DALI, others in future).
 * Returns an object with possibly modified inputMappings and constructorArgs for declaration.
 */
function handleLibrarySpecials(
  fbType: string,
  inputMappings: string,
  instanceManager: InstanceManager,
  hardwareModel: HardwareModel
): { inputMappings: string; constructorArgs?: string } {
  // DALI special handling
  if (fbType.startsWith("FB_DALI")) {
    const daliComType = detectDaliComType(hardwareModel);
    if (!daliComType) {
      throw new Error(
        "DALI communication moduleType not found in hardware. Please declare a portgroup with a supported DALI moduleType (e.g., KL6811, KL6821, EL6821) to use FB_DALI function blocks."
      );
    }
    const daliComInstance = instanceManager.getDaliComInstance(daliComType);
    if (!daliComInstance) {
      throw new Error("DALI communication FB instance was not generated.");
    }
    // Only set constructorArgs, do NOT prepend to inputMappings
    return {
      inputMappings,
      constructorArgs: daliComInstance.instanceName,
    };
  }
  // Add more library-specific handling here as needed
  return { inputMappings };
}

/**
 * Handles generation of the main program (MAIN)
 */
export class MainProgramGenerator {
  private readonly controlModel: ControlModel;
  private readonly hardwareModel: HardwareModel;
  private readonly destination: string;
  private readonly instanceManager: InstanceManager;
  private readonly statementConverter: StatementConverter;
  private readonly expressionConverter: ExpressionConverter;
  private readonly hardwareProcessor: HardwareProcessor;

  constructor(
    controlModel: ControlModel,
    hardwareModel: HardwareModel,
    destination: string,
    instanceManager: InstanceManager,
    statementConverter: StatementConverter,
    expressionConverter: ExpressionConverter,
    hardwareProcessor: HardwareProcessor
  ) {
    this.controlModel = controlModel;
    this.hardwareModel = hardwareModel;
    this.destination = destination;
    this.instanceManager = instanceManager;
    this.statementConverter = statementConverter;
    this.expressionConverter = expressionConverter;
    this.hardwareProcessor = hardwareProcessor;
  }

  writeProgramMain(): string[] {
    this.instanceManager.reset();
    this.instanceManager.addRequiredAdditionalFBInstances();

    const mainVars: EmittedVarDecl[] = [];
    const mainStatements: Statement[] = [];

    this.collectGlobalVarDecls(mainVars);
    this.processControlUnits(mainVars, mainStatements);

    const loopVars = new Map<string, { type: string; init?: Expr }>();
    this.statementConverter.collectLoopVars(mainStatements, loopVars);
    const declaredVarNames = new Set(mainVars.map((v) => v.varDecl.name));
    const loopVarsToDeclare = Array.from(loopVars.entries()).filter(
      ([name]) => !declaredVarNames.has(name)
    );

    const { inputs, outputs } =
      this.hardwareProcessor.extractHardwareDatapoints();
    this.expressionConverter.updateHardwareChannelFlatNames(
      new Set([...inputs.map((i) => i.name), ...outputs.map((o) => o.name)])
    );

    this.instanceManager.assignEdgeDetectionInstances(mainStatements);
    this.instanceManager.assignAfterStmtInstances(mainStatements);
    const fbInstanceDecls = this.instanceManager.getAllFBInstanceDeclarations();
    const afterStmtDecls = this.instanceManager.getAllAfterStmtDeclarations();
    const { scheduled, conditional, regular } = extractControlUnits(
      this.controlModel
    );

    let implContent = this.generateMainImplContent(
      scheduled,
      conditional,
      regular
    );
    // Check if any of the boilerplate variables are used
    const boilerplateVars = ["fbLocalTime", "timeNow", "todNow", "dNow"];
    const usesBoilerplate = boilerplateVars.some((v) =>
      implContent.includes(v)
    );

    const declContent = this.generateMainDeclContent(
      { inputs, outputs },
      mainVars,
      loopVarsToDeclare,
      fbInstanceDecls,
      afterStmtDecls,
      { scheduled, conditional },
      usesBoilerplate
    );

    const declFilePath = path.join(this.destination, `MAIN_decl.st`);
    // Ensure the destination directory exists
    fs.mkdirSync(this.destination, { recursive: true });
    fs.writeFileSync(declFilePath, declContent);
    const implFilePath = path.join(this.destination, `MAIN_impl.st`);
    fs.writeFileSync(implFilePath, implContent.trimEnd());
    return [declFilePath, implFilePath];
  }

  private processControlUnits(
    mainVars: EmittedVarDecl[],
    mainStatements: Statement[]
  ) {
    for (const item of this.controlModel.controlBlock.items) {
      if (!isControlUnit(item)) continue;
      const controlUnit = item;
      // Filter out variable declarations and only add executable statements
      const executableStmts = controlUnit.stmts.filter(
        (stmt) => !isVarDecl(stmt)
      ) as Statement[];
      mainStatements.push(...executableStmts);
      this.addVarDeclsFromControlUnit(controlUnit, mainVars);
      this.instanceManager.assignFBInstancesFromControlUnit(controlUnit);
    }
  }

  private collectGlobalVarDecls(mainVars: EmittedVarDecl[]) {
    const globalVarDecls =
      this.controlModel.controlBlock.items.filter(isVarDecl);
    globalVarDecls.forEach((varDecl) =>
      mainVars.push(new EmittedVarDecl(varDecl))
    );
  }

  private addVarDeclsFromControlUnit(
    controlUnit: ControlUnit,
    mainVars: EmittedVarDecl[]
  ) {
    const varDecls = controlUnit.stmts.filter(isVarDecl);
    mainVars.push(
      ...varDecls.map((varDecl) => new EmittedVarDecl(varDecl, controlUnit))
    );
  }

  generateMainDeclContent(
    hardware: { inputs: HardwareDatapoint[]; outputs: HardwareDatapoint[] },
    mainVars: EmittedVarDecl[],
    loopVarsToDeclare: [string, { type: string; init?: Expr }][],
    fbInstanceDecls: Array<{ instanceName: string; fbType: string }>,
    afterStmtDecls: AfterStmtInstanceInfo[],
    controlUnits: {
      scheduled: ScheduledControlUnit[];
      conditional: ConditionalControlUnit[];
    },
    usesBoilerplate: boolean = true
  ): string {
    const { inputs, outputs } = hardware;
    const { scheduled, conditional } = controlUnits;
    return toString(
      expandToNode`
        PROGRAM MAIN
        VAR
            ${joinToNode(
              inputs,
              (input) => expandToNode`
                ${input.name} AT %I*: ${input.type}; (* Input channel from hardware *)
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              outputs,
              (output) => expandToNode`
                ${output.name} AT %Q*: ${output.type}; (* Output channel to hardware *)
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              mainVars,
              (v) => expandToNode`
                ${v.name}: ${TypeConverter.convertTypeRefToST(
                v.varDecl.typeRef
              )}${
                v.varDecl.init
                  ? ` := ${this.expressionConverter.convertExprToST(
                      v.varDecl.init
                    )}`
                  : ""
              };
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              loopVarsToDeclare,
              ([name, { type, init }]) => expandToNode`
                ${name}: ${type}${
                init
                  ? ` := ${this.expressionConverter.convertExprToST(init)}`
                  : ""
              };
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              fbInstanceDecls,
              ({ instanceName, fbType }) => {
                // Library special handling for constructor
                const special = handleLibrarySpecials(
                  fbType,
                  "",
                  this.instanceManager,
                  this.hardwareModel
                );
                if (special.constructorArgs) {
                  return expandToNode`
                    ${instanceName}: ${fbType}(${special.constructorArgs}); (* Function block instance *)
                  `;
                }
                return expandToNode`
                  ${instanceName}: ${fbType}; (* Function block instance *)
                `;
              },
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              afterStmtDecls,
              ({ tonName, ptValue }) => expandToNode`
                ${tonName}: TON := (PT := ${ptValue});
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              scheduled,
              (unit) => expandToNode`
                ${unit.name}_hasRun: BOOL := FALSE;
                ${unit.name}_lastRunDay: DATE;
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              conditional.filter((unit) => unit.runOnce),
              (unit) => expandToNode`
                ${unit.name}_hasRun: BOOL := FALSE;
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            bRunOnlyOnce: BOOL := FALSE;${
              usesBoilerplate
                ? expandToNode`\n
            fbLocalTime: FB_LocalSystemTime := (
              sNetID := '',
              bEnable := TRUE,
              dwCycle := 5
            );
            timeNow: TIMESTRUCT;
            todNow: TIME_OF_DAY;
            dNow: DATE;
            `
                : ""
            }
        END_VAR
      `
    );
  }

  generateMainImplContent(
    scheduled: ScheduledControlUnit[],
    conditional: ConditionalControlUnit[],
    regular: RegularControlUnit[]
  ): string {
    const units = this.controlModel.controlBlock.items.filter(isControlUnit);

    // Patch: Only emit boilerplate if used in any statement
    let mainBody = toString(expandToNode`
    ${joinToNode(
      units,
      (unit) => {
        const sch = scheduled.find((u) => u.name === unit.name);
        if (sch) {
          return expandToNode`
          // Scheduled Control Unit '${sch.name}' @ ${sch.timeLiteral}
          IF dNow <> ${sch.name}_lastRunDay THEN
              ${sch.name}_hasRun := FALSE;
          END_IF;
          IF (NOT ${sch.name}_hasRun) AND (todNow >= ${sch.timeLiteral}) THEN
          ${joinToNode(
            sch.stmts.filter((s) => !isVarDecl(s)),
            (stmt) => expandToNode`
              ${this.statementConverter.convertStatementToST(stmt, 1)}
          `,
            { appendNewLineIfNotEmpty: true }
          )}
              ${sch.name}_hasRun      := TRUE;
              ${sch.name}_lastRunDay := dNow;
          END_IF;
        `;
        }

        const cond = conditional.find((u) => u.name === unit.name);
        if (cond) {
          if (cond.runOnce) {
            return expandToNode`
            // Conditional Control Unit '${cond.name}' (runOnce)
            IF NOT (${this.expressionConverter.convertExprToST(
              cond.condition
            )}) THEN
                ${cond.name}_hasRun := FALSE;
            END_IF;
            IF (NOT ${
              cond.name
            }_hasRun) AND (${this.expressionConverter.convertExprToST(
              cond.condition
            )}) THEN
            ${joinToNode(
              cond.stmts.filter((s) => !isVarDecl(s)),
              (stmt) => expandToNode`
                ${this.statementConverter.convertStatementToST(stmt, 1)}
            `,
              { appendNewLineIfNotEmpty: true }
            )}
                ${cond.name}_hasRun := TRUE;
            END_IF;
          `;
          } else {
            return expandToNode`
            // Conditional Control Unit '${cond.name}'
            IF ${this.expressionConverter.convertExprToST(cond.condition)} THEN
            ${joinToNode(
              cond.stmts.filter((s) => !isVarDecl(s)),
              (stmt) => expandToNode`
                ${this.statementConverter.convertStatementToST(stmt, 1)}
            `,
              { appendNewLineIfNotEmpty: true }
            )}
            END_IF;
          `;
          }
        }

        const reg = regular.find((u) => u.name === unit.name)!;
        return expandToNode`
        // Control Unit '${reg.name}'
        ${joinToNode(
          reg.stmts.filter((s) => !isVarDecl(s)),
          (stmt) => expandToNode`
            ${this.statementConverter.convertStatementToST(stmt, 0)}
        `,
          { appendNewLineIfNotEmpty: true }
        )}
      `;
      },
      { appendNewLineIfNotEmpty: true, prefix: "\n" }
    )}
    `);

    // Check if boilerplate is needed
    const boilerplateVars = ["fbLocalTime", "timeNow", "todNow", "dNow"];
    const usesBoilerplate = boilerplateVars.some((v) => mainBody.includes(v));

    // Emit init code only if needed
    let boilerplateInit = usesBoilerplate
      ? `fbLocalTime();\ntimeNow := fbLocalTime.systemTime;\ntodNow := SYSTEMTIME_TO_TOD(timeNow);\ndNow := DT_TO_DATE(SYSTEMTIME_TO_DT(timeNow));`
      : "";
    return `IF NOT bRunOnlyOnce THEN\n    ADSLOGSTR(\n      msgCtrlMask := ADSLOG_MSGTYPE_LOG,\n      msgFmtStr   := 'Program started %s',\n      strArg      := 'successfully!'\n    );\n    bRunOnlyOnce := TRUE;\nEND_IF;${
      boilerplateInit.length == 0 ? "" : "\n"
    }${boilerplateInit}\n${mainBody}`;
  }
}
