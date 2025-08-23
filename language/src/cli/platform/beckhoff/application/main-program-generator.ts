import { expandToNode, joinToNode, toString } from "langium/generate";
import * as fs from "node:fs";
import * as path from "node:path";
import { GlobalInstanceManager } from "./global-instance-manager.js";
import { StatementConverter } from "./statement-converter.js";
import { ExpressionConverter } from "./expression-converter.js";
import { HardwareProcessor } from "./hardware-processor.js";
import { LoopVariableAnalyzer } from "./loop-variable-analyzer.js";
import { BoilerplateAnalyzer } from "./boilerplate-analyzer.js";
import { LibraryHandlerManager } from "./library-handlers/library-handler-manager.js";
import { EmittedVarDecl, HardwareDatapoint } from "../models/types.js";
import { isScheduledControlUnit, isConditionalControlUnit } from "../utils.js";
import { TypeRefConverter } from "./type-ref-converter.js";
import {
  HardwareModel,
  ControlModel,
  Statement,
  isControlUnit,
  isVarDecl,
  ControlUnit,
  isStatement,
} from "../../../../language/generated/ast.js";

/**
 * Handles generation of the main program (MAIN)
 */
export class MainProgramGenerator {
  private readonly controlModel: ControlModel;
  private readonly hardwareModel: HardwareModel;
  private readonly destination: string;
  private readonly instanceManager: GlobalInstanceManager;
  private readonly statementConverter: StatementConverter;
  private readonly expressionConverter: ExpressionConverter;
  private readonly hardwareProcessor: HardwareProcessor;

  constructor(
    controlModel: ControlModel,
    hardwareModel: HardwareModel,
    destination: string,
    instanceManager: GlobalInstanceManager,
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

  public writeProgramMain(): string[] {
    this.instanceManager.reset();
    this.instanceManager.addRequiredAdditionalFBInstances();

    const { inputs, outputs } =
      this.hardwareProcessor.extractHardwareDatapoints();
    this.expressionConverter.setHardwareChannelSymbols(
      new Set([...inputs.map((i) => i.name), ...outputs.map((o) => o.name)])
    );

    const globalVars = this.collectGlobalVarDecls();
    const { controlUnitVars, mainStatements } = this.collectControlUnitData();
    const mainVars = [...globalVars, ...controlUnitVars];

    this.instanceManager.assignFBInstances(
      mainStatements,
      this.controlModel.controlBlock.items.filter(isControlUnit)
    );

    let implContent = this.generateMainImplContent();

    const declContent = this.generateMainDeclContent(
      { inputs, outputs },
      mainStatements,
      mainVars,
      BoilerplateAnalyzer.isTimeBoilerplateNeeded(implContent)
    );

    const declFilePath = path.join(this.destination, `MAIN_decl.st`);
    // Ensure the destination directory exists
    fs.mkdirSync(this.destination, { recursive: true });
    fs.writeFileSync(declFilePath, declContent);
    const implFilePath = path.join(this.destination, `MAIN_impl.st`);
    fs.writeFileSync(implFilePath, implContent.trimEnd());
    return [declFilePath, implFilePath];
  }

  private collectControlUnitData(): {
    controlUnitVars: EmittedVarDecl[];
    mainStatements: Statement[];
  } {
    const controlUnitVars: EmittedVarDecl[] = [];
    const mainStatements: Statement[] = [];

    for (const item of this.controlModel.controlBlock.items) {
      if (!isControlUnit(item)) continue;
      const controlUnit = item;

      // Collect executable statements from the control unit
      const executableStmts = controlUnit.stmts.filter(
        (stmt) => !isVarDecl(stmt)
      ) as Statement[];
      mainStatements.push(...executableStmts);

      // Collect variable declarations from the control unit
      const unitVars = this.getVarDeclsFromControlUnit(controlUnit);
      controlUnitVars.push(...unitVars);
    }

    return { controlUnitVars, mainStatements };
  }

  private collectGlobalVarDecls(): EmittedVarDecl[] {
    const globalVarDecls =
      this.controlModel.controlBlock.items.filter(isVarDecl);
    return globalVarDecls.map((varDecl) => new EmittedVarDecl(varDecl));
  }

  private getVarDeclsFromControlUnit(
    controlUnit: ControlUnit
  ): EmittedVarDecl[] {
    const varDecls = controlUnit.stmts.filter(isVarDecl);
    return varDecls.map((varDecl) => new EmittedVarDecl(varDecl, controlUnit));
  }

  private generateMainDeclContent(
    hardware: { inputs: HardwareDatapoint[]; outputs: HardwareDatapoint[] },
    mainStatements: Statement[],
    mainVars: EmittedVarDecl[],
    usesBoilerplate: boolean = true
  ): string {
    const { inputs, outputs } = hardware;
    const fbInstanceDecls = this.instanceManager.getFBInstanceDeclarations();
    const edgeStmtDecls =
      this.instanceManager.getEdgeStmtInstanceDeclarations();
    const afterStmtDecls =
      this.instanceManager.getAfterStmtInstanceDeclarations();
    const allLoopVars = LoopVariableAnalyzer.collectLoopVars(mainStatements);
    const declaredVarNames = new Set(mainVars.map((v) => v.varDecl.name));
    const loopVarsToDeclare = allLoopVars.filter(
      (loopVar) => !declaredVarNames.has(loopVar.name)
    );

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
                ${v.name}: ${TypeRefConverter.emit(v.varDecl.typeRef)}${
                v.varDecl.init
                  ? ` := ${this.expressionConverter.emit(v.varDecl.init)}`
                  : ""
              };
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              loopVarsToDeclare,
              (loopVar) => expandToNode`
                ${loopVar.name}: ${loopVar.type}${
                loopVar.init
                  ? ` := ${this.expressionConverter.emit(loopVar.init)}`
                  : ""
              };
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              fbInstanceDecls,
              ({ instanceName, fbType }) => {
                // Library special handling for constructor
                const special = LibraryHandlerManager.handleLibrarySpecials(
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
              edgeStmtDecls,
              ({ instanceName, fbType }) =>
                expandToNode`${instanceName}: ${fbType}; (* Function block instance *)`,
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              afterStmtDecls,
              ({ tonName, ptValue, triggerName }) => expandToNode`
                ${tonName}: TON := (PT := ${ptValue});
                ${triggerName}: R_TRIG;
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            bRunOnlyOnce: BOOL := FALSE;${
              usesBoilerplate
                ? BoilerplateAnalyzer.getTimeBoilerplateDeclarations()
                : ""
            }
        END_VAR
      `
    );
  }

  private generateMainImplContent(): string {
    const units = this.controlModel.controlBlock.items.filter(isControlUnit);

    let mainBody = toString(expandToNode`
    ${joinToNode(
      units,
      (unit) => {
        let unitStatements = unit.stmts.filter(
          (s) => isStatement(s) && !isVarDecl(s)
        ) as Statement[];

        if (isScheduledControlUnit(unit)) {
          const { instanceName } =
            this.instanceManager.getOrAssignUnitTriggerInstance(unit);
          const condition = `todNow >= ${unit.timeLiteral}`;
          return expandToNode`
            // Scheduled Control Unit '${unit.name}' @ ${unit.timeLiteral}
            ${instanceName}(CLK := ${condition});
            IF ${instanceName}.Q THEN
            ${joinToNode(
              unitStatements,
              (stmt: Statement) => this.statementConverter.emit(stmt, 1),
              { appendNewLineIfNotEmpty: true }
            )}
            END_IF;
          `;
        }

        if (isConditionalControlUnit(unit)) {
          const condition = this.expressionConverter.emit(unit.condition);
          if (unit.isOnce) {
            const { instanceName } =
              this.instanceManager.getOrAssignUnitTriggerInstance(unit);
            return expandToNode`
              // Conditional Control Unit '${unit.name}' (runOnce)
              ${instanceName}(CLK := ${condition});
              IF ${instanceName}.Q THEN
              ${joinToNode(
                unitStatements,
                (stmt: Statement) => this.statementConverter.emit(stmt, 1),
                { appendNewLineIfNotEmpty: true }
              )}
              END_IF;
            `;
          } else {
            return expandToNode`
              // Conditional Control Unit '${unit.name}'
              IF ${condition} THEN
              ${joinToNode(
                unitStatements,
                (stmt: Statement) => this.statementConverter.emit(stmt, 1),
                { appendNewLineIfNotEmpty: true }
              )}
              END_IF;
            `;
          }
        }

        return expandToNode`
        // Control Unit '${unit.name}'
        ${joinToNode(
          unitStatements,
          (stmt) => expandToNode`
            ${this.statementConverter.emit(stmt, 0)}
        `,
          { appendNewLineIfNotEmpty: true }
        )}
      `;
      },
      { appendNewLineIfNotEmpty: true, prefix: "\n" }
    )}
    `);

    const boilerplateInit = BoilerplateAnalyzer.isTimeBoilerplateNeeded(
      mainBody
    )
      ? BoilerplateAnalyzer.getTimeInitializationCode()
      : "";
    return `IF NOT bRunOnlyOnce THEN\n    ADSLOGSTR(\n      msgCtrlMask := ADSLOG_MSGTYPE_LOG,\n      msgFmtStr   := 'Program started %s',\n      strArg      := 'successfully!'\n    );\n    bRunOnlyOnce := TRUE;\nEND_IF;${
      boilerplateInit.length == 0 ? "" : "\n"
    }${boilerplateInit}\n${mainBody}`;
  }
}
