import {
  ControlModel,
  isEnumDecl,
  isFunctionBlockDecl,
  isStructDecl,
  HardwareModel,
  EnumDecl,
  StructDecl,
  FunctionBlockDecl,
  VarDecl,
  Primary,
  isRef,
  isBinExpr,
  isNegExpr,
  isNotExpr,
  isPrimary,
  isArrayLiteral,
  isStructLiteral,
  isEnumMemberLiteral,
  Statement,
  isAssignmentStmt,
  isIfStmt,
  isWhileStmt,
  isForStmt,
  isSwitchStmt,
  isUseStmt,
  isExpressionStmt,
  isOnRisingEdgeStmt,
  isOnFallingEdgeStmt,
  Expr,
  isParenExpr,
  isControlUnit,
  isVarDecl,
  isBreakStmt,
  isContinueStmt,
  UseStmt,
  NamedElement,
  ControlUnit,
  TypeRef,
  Ref,
  SwitchStmt,
  ForStmt,
  IfStmt,
  WhileStmt,
  isAfterStmt,
  AfterStmt,
  PortGroup,
  Datapoint,
} from "../../../language/generated/ast.js";
import { expandToNode, joinToNode, toString } from "langium/generate";
import * as fs from "node:fs";
import * as path from "node:path";
import { Reference } from "langium";
import {
  ConditionalControlUnit,
  detectDaliComType,
  extractControlUnits,
  RegularControlUnit,
  ScheduledControlUnit,
} from "./utils.js";
import {
  getOutputs,
  getInputs,
  getLocals,
  getLogic,
} from "../../../language/control/utils/function-block-utils.js";
import {
  getPortGroups,
  getDatapoints,
} from "../../../language/hardware/utils/component-utils.js";
import { getControllers } from "../../../language/hardware/utils/hardware-definition-utils.js";
import { TcConfigGenerator } from "./config-generator.js";

// Helper function to check if a node is a primitive value
function isPrimitive(expr: Primary): boolean {
  return (
    typeof expr.val === "number" ||
    typeof expr.val === "string" ||
    typeof expr.val === "boolean"
  );
}

/**
 * Helper function to extract the name from a reference with improved debugging
 * This function properly handles all types of references in our AST
 */
function getReferenceName(ref: Reference<NamedElement>): string {
  return (
    ref?.$refText ??
    (console.warn("Unresolved reference:", JSON.stringify(ref, null, 2)),
    "UNRESOLVED_REF")
  );
}

/**
 * Check if a referenced element belongs to a control unit
 * This helps us determine if we need to qualify the variable name
 */
function isControlUnitVariable(
  ref: Reference<NamedElement>
): [boolean, string | null] {
  const container = ref?.ref?.$container;
  return container && isControlUnit(container)
    ? [true, container.name]
    : [false, null];
}

/**
 * Translate operators from DSL to ST format
 */
function translateOperator(op: string): string {
  switch (op) {
    case "&&":
      return "AND";
    case "||":
      return "OR";
    case "==":
      return "=";
    case "!=":
      return "<>";
    default:
      return op;
  }
}

interface FBInstanceInfo {
  kind: "fb";
  instanceName: string;
  fbType: string;
}

interface AfterStmtInstanceInfo {
  kind: "after";
  tonName: string;
  ptValue: string;
}

type InstanceInfo = FBInstanceInfo | AfterStmtInstanceInfo;

interface HardwareDatapoint {
  name: string;
  type: string;
}

interface HardwareDatapointsResult {
  inputs: HardwareDatapoint[];
  outputs: HardwareDatapoint[];
}

class BeckhoffGeneratorContext {
  controlModel: ControlModel;
  hardwareModel: HardwareModel;
  destination: string;

  hardwareChannelFlatNames: Set<string>;
  fbInstanceMap: Map<any, InstanceInfo>; // Key: UseStmt, edge, or AfterStmt, Value: InstanceInfo
  fbInstanceCounter: number;
  tcConfigGenerator: TcConfigGenerator;

  constructor(
    controlModel: ControlModel,
    hardwareModel: HardwareModel,
    destination: string
  ) {
    this.controlModel = controlModel;
    this.hardwareModel = hardwareModel;
    this.destination = destination;
    this.hardwareChannelFlatNames = new Set();
    this.fbInstanceMap = new Map();
    this.fbInstanceCounter = 1;
    this.tcConfigGenerator = new TcConfigGenerator(controlModel, hardwareModel);
  }

  // Generate a globally unique FB instance name
  createUniqueFBInstanceName(fbType: string): string {
    const name = `${fbType.charAt(0).toLowerCase()}${fbType.slice(1)}Instance${
      this.fbInstanceCounter
    }`;
    this.fbInstanceCounter++;
    return name;
  }

  // Assign or get a unique FB instance for a UseStmt
  getOrAssignFBInstance(useStmt: UseStmt): FBInstanceInfo {
    if (this.fbInstanceMap.has(useStmt)) {
      return this.fbInstanceMap.get(useStmt)! as FBInstanceInfo;
    }
    const fbType = useStmt.functionBlockRef.ref?.name ?? "UNKNOWN_FB";
    const instanceName = this.createUniqueFBInstanceName(fbType);
    const info: FBInstanceInfo = { kind: "fb", instanceName, fbType };
    this.fbInstanceMap.set(useStmt, info);
    return info;
  }

  // Assign or get a unique FB instance for edge detection
  getOrAssignEdgeFBInstance(
    stmt: Statement,
    type: "rising" | "falling",
    fbType: string
  ): FBInstanceInfo {
    if (this.fbInstanceMap.has(stmt)) {
      return this.fbInstanceMap.get(stmt)! as FBInstanceInfo;
    }
    const instanceName = this.createUniqueFBInstanceName(fbType);
    const info: FBInstanceInfo = { kind: "fb", instanceName, fbType };
    this.fbInstanceMap.set(stmt, info);
    return info;
  }

  // Assign or get a unique AfterStmt instance (TON timer)
  getOrAssignAfterStmtInstance(stmt: AfterStmt): AfterStmtInstanceInfo {
    if (this.fbInstanceMap.has(stmt)) {
      return this.fbInstanceMap.get(stmt)! as AfterStmtInstanceInfo;
    }
    const idx = this.fbInstanceCounter++;
    const tonName = `tonAfter${idx}`;
    const ptValue = stmt.time;
    const info: AfterStmtInstanceInfo = {
      kind: "after",
      tonName,
      ptValue,
    };
    this.fbInstanceMap.set(stmt, info);
    return info;
  }

  // Get all instance declarations for main program
  getAllFBInstanceDeclarations(): Array<{
    instanceName: string;
    fbType: string;
  }> {
    // Use a Set to avoid duplicates if the same instance is referenced by multiple keys
    const seen = new Set<string>();
    const result: Array<{ instanceName: string; fbType: string }> = [];
    for (const info of this.fbInstanceMap.values()) {
      if (info.kind === "fb" && !seen.has(info.instanceName)) {
        seen.add(info.instanceName);
        result.push({ instanceName: info.instanceName, fbType: info.fbType });
      }
    }
    return result;
  }

  // Get all AfterStmt instance declarations for main program
  getAllAfterStmtDeclarations(): AfterStmtInstanceInfo[] {
    return Array.from(this.fbInstanceMap.values()).filter(
      (info): info is AfterStmtInstanceInfo => info.kind === "after"
    );
  }

  getQualifiedReferenceName(ref: Reference<NamedElement>): string {
    const [isInControlUnit, unitName] = isControlUnitVariable(ref);
    if (isInControlUnit && unitName && isVarDecl(ref.ref)) {
      return `${unitName}_${getReferenceName(ref)}`;
    }
    return getReferenceName(ref);
  }

  convertExprToST(expr: Expr): string {
    if (isPrimary(expr)) {
      return this.convertPrimaryExprToST(expr);
    }
    if (isBinExpr(expr)) return this.handleBinExpr(expr);
    return "UNKNOWN_EXPR";
  }

  private convertPrimaryExprToST(expr: Primary): string {
    if (expr.isNow) return "todNow";
    if (isRef(expr)) return this.handleRefExpr(expr);
    if (isParenExpr(expr)) return this.handleParenExpr(expr);
    if (isNegExpr(expr)) return this.handleNegExpr(expr);
    if (isNotExpr(expr)) return this.handleNotExpr(expr);
    if (isArrayLiteral(expr.val)) return this.handleArrayLiteral(expr);
    if (isStructLiteral(expr.val)) return this.handleStructLiteral(expr);
    if (isPrimitive(expr)) return this.primitiveToST(expr.val);
    return "UNKNOWN_PRIMARY_EXPR";
  }

  private handleParenExpr(expr: any): string {
    return `(${this.convertExprToST(expr.expr)})`;
  }

  private handleNegExpr(expr: any): string {
    return `-${this.convertExprToST(expr.expr)}`;
  }

  private handleNotExpr(expr: any): string {
    return `NOT ${this.convertExprToST(expr.expr)}`;
  }

  private handleArrayLiteral(expr: any): string {
    // For multi-dimensional arrays, we need to flatten the array elements
    const flatElements = expr.val.elements.flatMap((e: any) => {
      if (isPrimary(e) && isArrayLiteral(e.val)) {
        return e.val.elements.map((nestedE: any) =>
          this.convertExprToST(nestedE)
        );
      }
      return [this.convertExprToST(e)];
    });
    return `[${flatElements.join(", ")}]`;
  }

  private handleStructLiteral(expr: any): string {
    return `(${expr.val.fields
      .map((f: any) => `${f.name}:=${this.convertExprToST(f.value)}`)
      .join(", ")})`;
  }

  private handleBinExpr(expr: any): string {
    const op = translateOperator(expr.op);
    return `${this.convertExprToST(expr.e1)} ${op} ${this.convertExprToST(
      expr.e2
    )}`;
  }

  handleRefExpr(expr: Ref): string {
    if (expr.ref && expr.properties?.length === 1) {
      const flat = `${getReferenceName(expr.ref)}_${getReferenceName(
        expr.properties[0]
      )}`;
      if (this.hardwareChannelFlatNames.has(flat)) return flat;
    }
    if (expr.ref) {
      let result = this.getQualifiedReferenceName(expr.ref);
      if (expr.indices?.length)
        result += `[${expr.indices
          .map((idx) => this.convertExprToST(idx))
          .join(", ")}]`;
      if (expr.properties?.length)
        result += `.${expr.properties.map(getReferenceName).join(".")}`;
      return result;
    }
    return "UNKNOWN_REF";
  }

  primitiveToST(val: any): string {
    if (typeof val === "string") {
      const isTodString = RegExp(/TOD#[0-9:]+/).exec(val);
      if (isTodString) {
        return val;
      } else {
        return `'${val.replaceAll('"', "")}'`;
      }
    }
    if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
    if (val !== undefined) return val.toString();
    return "";
  }

  convertStatementToST(stmt: Statement, indent: number = 0): string {
    const pad = (level: number) => "    ".repeat(level);
    if (isAssignmentStmt(stmt))
      return (
        pad(indent) +
        `${this.convertExprToST(stmt.target)} := ${this.convertExprToST(
          stmt.value
        )};`
      );
    if (isIfStmt(stmt)) return this.stIf(stmt, indent);
    if (isWhileStmt(stmt)) return this.stWhile(stmt, indent);
    if (isForStmt(stmt)) return this.stFor(stmt, indent);
    if (isSwitchStmt(stmt)) return this.stSwitch(stmt, indent);
    if (isAfterStmt(stmt)) return this.stAfter(stmt, indent);
    if (isBreakStmt(stmt)) return pad(indent) + `EXIT;`;
    if (isContinueStmt(stmt)) return pad(indent) + `CONTINUE;`;
    if (isExpressionStmt(stmt))
      return pad(indent) + `${this.convertExprToST(stmt.expr)};`;
    if (isUseStmt(stmt)) return this.stUse(stmt, indent);
    if (isOnRisingEdgeStmt(stmt)) return this.stEdge(stmt, indent, true);
    if (isOnFallingEdgeStmt(stmt)) return this.stEdge(stmt, indent, false);
    if (isVarDecl(stmt))
      return (
        pad(indent) +
        `${stmt.name}: ${convertTypeRefToST(stmt.typeRef)}${
          stmt.init ? ` := ${this.convertExprToST(stmt.init)}` : ""
        };`
      );
    return (
      pad(indent) + `// Unsupported statement type: ${(stmt as any).$type}`
    );
  }

  stIf(stmt: IfStmt, indent: number): string {
    const pad = (level: number) => "    ".repeat(level);
    let result =
      pad(indent) + `IF ${this.convertExprToST(stmt.condition)} THEN\n`;
    result +=
      stmt.stmts
        .map((s: any) => this.convertStatementToST(s, indent + 1))
        .join("\n") + "\n";
    for (const elseIfStmt of stmt.elseIfStmts) {
      result +=
        pad(indent) +
        `ELSIF ${this.convertExprToST(elseIfStmt.condition)} THEN\n`;
      result +=
        elseIfStmt.stmts
          .map((s: any) => this.convertStatementToST(s, indent + 1))
          .join("\n") + "\n";
    }
    if (stmt.elseStmt) {
      result += pad(indent) + `ELSE\n`;
      result +=
        (stmt.elseStmt.stmts || [])
          .map((s: any) => this.convertStatementToST(s, indent + 1))
          .join("\n") + "\n";
    }
    result += pad(indent) + `END_IF;`;
    return result;
  }

  stWhile(stmt: WhileStmt, indent: number): string {
    const pad = (level: number) => "    ".repeat(level);
    let result = `${pad(indent)}WHILE ${this.convertExprToST(
      stmt.condition
    )} DO\n`;
    result +=
      stmt.stmts
        .map((subStmt: any) => this.convertStatementToST(subStmt, indent + 1))
        .join("\n") + "\n";
    result += `${pad(indent)}END_WHILE;`;
    return result;
  }

  stFor(stmt: ForStmt, indent: number): string {
    const pad = (level: number) => "    ".repeat(level);
    let result = `${pad(indent)}FOR ${stmt.loopVar.name} := ${
      stmt.loopVar.init ? this.convertExprToST(stmt.loopVar.init) : "0"
    } TO ${this.convertExprToST(stmt.toExpr)}${
      stmt.step ? ` BY ${this.convertExprToST(stmt.step)}` : ""
    } DO\n`;
    result +=
      stmt.stmts
        .map((s: any) => this.convertStatementToST(s, indent + 1))
        .join("\n") + "\n";
    result += `${pad(indent)}END_FOR;`;
    return result;
  }

  stSwitch(stmt: SwitchStmt, indent: number): string {
    const pad = (level: number) => "    ".repeat(level);
    let result = `${pad(indent)}CASE ${this.convertExprToST(stmt.expr)} OF\n`;
    for (const caseOption of stmt.cases) {
      const literals = caseOption.literals
        .map((lit: any) =>
          isEnumMemberLiteral(lit.val)
            ? `${lit.val.enumDecl.ref?.name}.${lit.val.member.ref?.name}`
            : String(lit.val)
        )
        .join(", ");
      result += `${pad(indent + 1)}${literals}:\n`;
      result +=
        caseOption.stmts
          .map((subStmt: any) => this.convertStatementToST(subStmt, indent + 2))
          .join("\n") + "\n";
    }
    if (stmt.default) {
      result += `${pad(indent + 1)}ELSE\n`;
      result +=
        stmt.default.stmts
          .map((subStmt: any) => this.convertStatementToST(subStmt, indent + 2))
          .join("\n") + "\n";
    }
    result += `${pad(indent)}END_CASE;`;
    return result;
  }

  stUse(stmt: UseStmt, indent: number): string {
    const pad = (level: number) => "    ".repeat(level);
    let useContent = "";
    const { instanceName } = this.getOrAssignFBInstance(stmt);
    const inputMappings = stmt.inputArgs
      .map(
        (arg) => `${arg.inputVar.ref?.name}:=${this.convertExprToST(arg.value)}`
      )
      .join(", ");
    // Handle output mapping
    if (stmt.useOutput.singleOutput) {
      // Get the FB's only output variable name
      const fb = stmt.functionBlockRef.ref;
      const outputs = fb ? getOutputs(fb) : [];
      const fbOutputVarName = outputs.length === 1 ? outputs[0].name : "output";
      const targetOutputVarRef = stmt.useOutput.singleOutput.targetOutputVar;
      const targetOutputVarName =
        this.getQualifiedReferenceName(targetOutputVarRef);
      useContent += `${pad(indent)}${instanceName}(${inputMappings});\n`;
      useContent += `${pad(
        indent
      )}${targetOutputVarName} := ${instanceName}.${fbOutputVarName};\n`;
    } else if (stmt.useOutput.mappingOutputs.length > 0) {
      useContent += `${pad(indent)}${instanceName}(${inputMappings});\n`;
      for (const outMapping of stmt.useOutput.mappingOutputs) {
        const targetOutputVarRef = outMapping.targetOutputVar;
        const targetOutputVarName =
          this.getQualifiedReferenceName(targetOutputVarRef);
        const fbOutputVarName = outMapping.fbOutputVar.ref?.name ?? "output";
        useContent += `${pad(
          indent
        )}${targetOutputVarName} := ${instanceName}.${fbOutputVarName};\n`;
      }
    } else {
      useContent += `${pad(indent)}${instanceName}(${inputMappings});\n`;
    }
    return useContent;
  }

  stEdge(stmt: any, indent: number, rising: boolean): string {
    const type = rising ? "rising" : "falling";
    return this.convertEdgeDetectionToST(stmt, type, indent);
  }

  convertEdgeDetectionToST(
    stmt: Statement,
    type: "rising" | "falling",
    indent: number = 0
  ): string {
    const pad = (level: number) => "    ".repeat(level);
    if (type === "rising" && isOnRisingEdgeStmt(stmt)) {
      const signalExpr = this.convertExprToST(stmt.signal);
      const { instanceName } = this.getOrAssignEdgeFBInstance(
        stmt,
        "rising",
        "R_TRIG"
      );
      let risingContent = `${pad(indent)}`;
      risingContent += `${pad(indent)}${instanceName}(CLK := ${signalExpr});\n`;
      risingContent += `${pad(indent)}IF ${instanceName}.Q THEN\n`;
      for (const subStmt of stmt.stmts) {
        risingContent += this.convertStatementToST(subStmt, indent + 1) + "\n";
      }
      risingContent += `${pad(indent)}END_IF;`;
      return risingContent;
    } else if (type === "falling" && isOnFallingEdgeStmt(stmt)) {
      const signalExpr = this.convertExprToST(stmt.signal);
      const { instanceName } = this.getOrAssignEdgeFBInstance(
        stmt,
        "falling",
        "F_TRIG"
      );
      let fallingContent = `${pad(indent)}`;
      fallingContent += `${pad(
        indent
      )}${instanceName}(CLK := ${signalExpr});\n`;
      fallingContent += `${pad(indent)}IF ${instanceName}.Q THEN\n`;
      for (const subStmt of stmt.stmts) {
        fallingContent += this.convertStatementToST(subStmt, indent + 1) + "\n";
      }
      fallingContent += `${pad(indent)}END_IF;`;
      return fallingContent;
    }
    return "// Error: Invalid edge detection statement";
  }

  stAfter(stmt: AfterStmt, indent: number): string {
    const pad = (level: number) => "    ".repeat(level);
    const { tonName } = this.getOrAssignAfterStmtInstance(stmt);
    const condition = this.convertExprToST((stmt as any).condition);
    const blockStmts = (stmt as any).stmts ?? [];
    // Generate more concise logic: TON is enabled by condition, actions run when Q and condition, TON reset after
    return (
      `${pad(indent)}${tonName}(IN := ${condition});\n` +
      `${pad(indent)}IF ${tonName}.Q THEN\n` +
      blockStmts
        .map((s: any) => this.convertStatementToST(s, indent + 1))
        .join("\n") +
      `\n${pad(indent + 1)}${tonName}(IN := FALSE);\n` +
      `${pad(indent)}END_IF\n`
    );
  }

  writeEnum(enumDecl: EnumDecl): string {
    const filePath = path.join(
      this.destination,
      "Enums",
      `${enumDecl.name}.st`
    );

    // Ensure the Enums directory exists
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const enumContent = toString(
      expandToNode`
        {attribute 'qualified_only'}
        {attribute 'strict'}
        TYPE ${enumDecl.name} :
        (
            ${joinToNode(
              enumDecl.members.map((member, index) => ({ member, index })),
              ({ member, index }) => expandToNode`
                ${member.name} := ${index}${
                index < enumDecl.members.length - 1 ? "," : ""
              }
              `,
              { appendNewLineIfNotEmpty: true }
            )}
        );
        END_TYPE
      `
    );

    fs.writeFileSync(filePath, enumContent);
    return filePath;
  }

  writeStruct(structDecl: StructDecl): string {
    const filePath = path.join(
      this.destination,
      "Structs",
      `${structDecl.name}.st`
    );

    // Ensure the Structs directory exists
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const structContent = toString(
      expandToNode`
        TYPE ${structDecl.name} :
        STRUCT
            ${joinToNode(
              structDecl.fields,
              (field) => expandToNode`
                ${field.name} : ${convertTypeRefToST(field.typeRef)}${
                field.init ? ` := ${this.convertExprToST(field.init)}` : ""
              };
              `,
              { appendNewLineIfNotEmpty: true }
            )}
        END_STRUCT
        END_TYPE
      `
    );

    fs.writeFileSync(filePath, structContent);
    return filePath;
  }

  writeFunctionBlock(fbDecl: FunctionBlockDecl): string[] {
    const files: string[] = [];

    // Get the different parts of the function block
    const inputs = getInputs(fbDecl);
    const outputs = getOutputs(fbDecl);
    const locals = getLocals(fbDecl);
    const logic = getLogic(fbDecl);

    // Collect all loop variables from the logic block
    const loopVars = new Map<string, { type: string; init?: Expr }>();
    this.collectLoopVars(logic?.stmts ?? [], loopVars);
    // Filter out loop vars already declared as locals
    const localNames = new Set(locals.map((l) => l.name));
    const loopVarsToDeclare = Array.from(loopVars.entries()).filter(
      ([name]) => !localNames.has(name)
    );

    // Write declaration file
    const declFilePath = path.join(
      this.destination,
      "FunctionBlocks",
      `${fbDecl.name}_decl.st`
    );
    // Ensure the FunctionBlocks directory exists
    fs.mkdirSync(path.dirname(declFilePath), { recursive: true });
    const declContent = toString(
      expandToNode`
        FUNCTION_BLOCK ${fbDecl.name}
        VAR_INPUT
            ${joinToNode(
              inputs,
              (input) => expandToNode`
                ${input.name}: ${convertTypeRefToST(input.typeRef)}${
                input.init ? ` := ${this.convertExprToST(input.init)}` : ""
              };
              `,
              { appendNewLineIfNotEmpty: true }
            )}
        END_VAR
        VAR_OUTPUT
            ${joinToNode(
              outputs,
              (output) => expandToNode`
                ${output.name}: ${convertTypeRefToST(output.typeRef)}${
                output.init ? ` := ${this.convertExprToST(output.init)}` : ""
              };
              `,
              { appendNewLineIfNotEmpty: true }
            )}
        END_VAR
        VAR
            ${joinToNode(
              locals,
              (local) => expandToNode`
                ${local.name}: ${convertTypeRefToST(local.typeRef)}${
                local.init ? ` := ${this.convertExprToST(local.init)}` : ""
              };
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              loopVarsToDeclare,
              ([name, { type, init }]) => expandToNode`
                ${name}: ${type}${
                init ? ` := ${this.convertExprToST(init)}` : ""
              };
              `,
              { appendNewLineIfNotEmpty: true }
            )}
        END_VAR
      `
    );
    fs.writeFileSync(declFilePath, declContent);
    files.push(declFilePath);

    // Write implementation file
    const implFilePath = path.join(
      this.destination,
      "FunctionBlocks",
      `${fbDecl.name}_impl.st`
    );
    const implContent = (logic?.stmts || [])
      .map((stmt) => this.convertStatementToST(stmt, 0).trimEnd())
      .join("\n");
    fs.writeFileSync(implFilePath, implContent);
    files.push(implFilePath);

    return files;
  }

  /**
   * Recursively collect all loop variables (from ForStmt) in a list of statements
   */
  collectLoopVars(
    stmts: Statement[],
    found: Map<string, { type: string; init?: Expr }>
  ) {
    for (const stmt of stmts) {
      if (isForStmt(stmt)) {
        this.handleForLoopVar(stmt, found);
      } else if (isIfStmt(stmt)) {
        this.handleIfLoopVar(stmt, found);
      } else if (isWhileStmt(stmt)) {
        this.collectLoopVars(stmt.stmts, found);
      } else if (isSwitchStmt(stmt)) {
        this.handleSwitchLoopVar(stmt, found);
      }
    }
  }

  private handleForLoopVar(
    stmt: any,
    found: Map<string, { type: string; init?: Expr }>
  ) {
    if (!found.has(stmt.loopVar.name)) {
      found.set(stmt.loopVar.name, {
        type: stmt.loopVar.typeRef.type ?? "INT",
        init: stmt.loopVar.init,
      });
    }
    this.collectLoopVars(stmt.stmts, found);
  }

  private handleIfLoopVar(
    stmt: any,
    found: Map<string, { type: string; init?: Expr }>
  ) {
    this.collectLoopVars(stmt.stmts, found);
    for (const elseIf of stmt.elseIfStmts) {
      this.collectLoopVars(elseIf.stmts, found);
    }
    if (stmt.elseStmt) {
      this.collectLoopVars(stmt.elseStmt.stmts, found);
    }
  }

  private handleSwitchLoopVar(
    stmt: any,
    found: Map<string, { type: string; init?: Expr }>
  ) {
    for (const c of stmt.cases) {
      this.collectLoopVars(c.stmts, found);
    }
    if (stmt.default) {
      this.collectLoopVars(stmt.default.stmts, found);
    }
  }

  // Walk statements to collect AfterStmt instances for unique TON/vars
  private assignAfterStmtInstances(mainStatements: Statement[]) {
    const walk = (stmts: Statement[]) => {
      for (const stmt of stmts) {
        if (isAfterStmt(stmt)) {
          this.getOrAssignAfterStmtInstance(stmt);
          walk((stmt as any).stmts ?? []);
        } else if (isIfStmt(stmt)) {
          walk(stmt.stmts);
          for (const elseIf of stmt.elseIfStmts) walk(elseIf.stmts);
          if (stmt.elseStmt) walk(stmt.elseStmt.stmts);
        } else if (isWhileStmt(stmt)) {
          walk(stmt.stmts);
        } else if (isForStmt(stmt)) {
          walk(stmt.stmts);
        } else if (isSwitchStmt(stmt)) {
          for (const c of stmt.cases) walk(c.stmts);
          if (stmt.default) walk(stmt.default.stmts);
        } else if (isOnRisingEdgeStmt(stmt) || isOnFallingEdgeStmt(stmt)) {
          walk(stmt.stmts);
        }
      }
    };
    walk(mainStatements);
  }

  writeProgramMain(): string[] {
    this.fbInstanceMap.clear();
    this.fbInstanceCounter = 1;
    this.addRequiredAdditionalFBInstances();

    const mainVars: EmittedVarDecl[] = [];
    const mainStatements: Statement[] = [];

    this.collectGlobalVarDecls(mainVars);
    this.processControlUnits(mainVars, mainStatements);

    const loopVars = new Map<string, { type: string; init?: Expr }>();
    this.collectLoopVars(mainStatements, loopVars);
    const declaredVarNames = new Set(mainVars.map((v) => v.varDecl.name));
    const loopVarsToDeclare = Array.from(loopVars.entries()).filter(
      ([name]) => !declaredVarNames.has(name)
    );

    const { inputs, outputs } = this.extractHardwareDatapoints();
    this.hardwareChannelFlatNames = new Set([
      ...inputs.map((i) => i.name),
      ...outputs.map((o) => o.name),
    ]);

    this.assignEdgeDetectionInstances(mainStatements);
    this.assignAfterStmtInstances(mainStatements);
    const fbInstanceDecls = this.getAllFBInstanceDeclarations();
    const afterStmtDecls = this.getAllAfterStmtDeclarations();
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
      mainStatements.push(...controlUnit.stmts);
      this.addVarDeclsFromControlUnit(controlUnit, mainVars);
      this.assignFBInstancesFromControlUnit(controlUnit);
    }
  }

  private addRequiredAdditionalFBInstances() {
    // Check if any extern function block from Tc3_DALI is used
    const hasExternDaliFB = this.controlModel.externTypeDecls.some(
      (item) =>
        isFunctionBlockDecl(item) &&
        item.isExtern &&
        item.name.startsWith("FB_DALI")
    );
    if (!hasExternDaliFB) return;

    // Try to detect the DALI communication FB type from hardware
    const daliComType = detectDaliComType(this.hardwareModel);
    if (!daliComType) {
      throw new Error(
        "DALI communication moduleType not found in hardware. Please declare a portgroup with a supported DALI moduleType (e.g., KL6811, KL6821, EL6821) to use FB_DALI function blocks."
      );
    }
    const fbType = daliComType;
    const key = `daliCom_${fbType}`;
    if (!this.fbInstanceMap.has(key)) {
      const instanceName = this.createUniqueFBInstanceName(fbType);
      this.fbInstanceMap.set(key, { kind: "fb", instanceName, fbType });
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

  private assignFBInstancesFromControlUnit(controlUnit: ControlUnit) {
    const useStmts = controlUnit.stmts.filter(isUseStmt);
    for (const useStmt of useStmts) {
      this.getOrAssignFBInstance(useStmt);
    }
  }

  private assignEdgeDetectionInstances(mainStatements: Statement[]) {
    const walk = (stmts: Statement[]) => {
      for (const stmt of stmts) {
        if (isOnRisingEdgeStmt(stmt)) {
          this.getOrAssignEdgeFBInstance(stmt, "rising", "R_TRIG");
          walk(stmt.stmts);
        } else if (isOnFallingEdgeStmt(stmt)) {
          this.getOrAssignEdgeFBInstance(stmt, "falling", "F_TRIG");
          walk(stmt.stmts);
        } else if (isIfStmt(stmt)) {
          walk(stmt.stmts);
          for (const elseIf of stmt.elseIfStmts) walk(elseIf.stmts);
          if (stmt.elseStmt) walk(stmt.elseStmt.stmts);
        } else if (isWhileStmt(stmt)) {
          walk(stmt.stmts);
        } else if (isForStmt(stmt)) {
          walk(stmt.stmts);
        } else if (isSwitchStmt(stmt)) {
          for (const c of stmt.cases) walk(c.stmts);
          if (stmt.default) walk(stmt.default.stmts);
        }
      }
    };
    walk(mainStatements);
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
    usesBoilerplate: boolean = true // new optional arg
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
                ${v.name}: ${convertTypeRefToST(v.varDecl.typeRef)}${
                v.varDecl.init
                  ? ` := ${this.convertExprToST(v.varDecl.init)}`
                  : ""
              };
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              loopVarsToDeclare,
              ([name, { type, init }]) => expandToNode`
                ${name}: ${type}${
                init ? ` := ${this.convertExprToST(init)}` : ""
              };
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              fbInstanceDecls,
              ({ instanceName, fbType }) => {
                // Library special handling for constructor
                const special = handleLibrarySpecials(fbType, "", this);
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
              ${this.convertStatementToST(stmt, 1)}
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
            IF NOT (${this.convertExprToST(cond.condition)}) THEN
                ${cond.name}_hasRun := FALSE;
            END_IF;
            IF (NOT ${cond.name}_hasRun) AND (${this.convertExprToST(
              cond.condition
            )}) THEN
            ${joinToNode(
              cond.stmts.filter((s) => !isVarDecl(s)),
              (stmt) => expandToNode`
                ${this.convertStatementToST(stmt, 1)}
            `,
              { appendNewLineIfNotEmpty: true }
            )}
                ${cond.name}_hasRun := TRUE;
            END_IF;
          `;
          } else {
            return expandToNode`
            // Conditional Control Unit '${cond.name}'
            IF ${this.convertExprToST(cond.condition)} THEN
            ${joinToNode(
              cond.stmts.filter((s) => !isVarDecl(s)),
              (stmt) => expandToNode`
                ${this.convertStatementToST(stmt, 1)}
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
            ${this.convertStatementToST(stmt, 0)}
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

  extractHardwareDatapoints(): HardwareDatapointsResult {
    const inputs: HardwareDatapoint[] = [];
    const outputs: HardwareDatapoint[] = [];
    for (const controller of getControllers(this.hardwareModel)) {
      this.processDatapoints(
        getDatapoints(controller),
        getPortGroups(controller),
        inputs,
        outputs
      );
    }
    return { inputs, outputs };
  }

  private processDatapoints(
    datapoints: Datapoint[],
    portGroups: PortGroup[],
    inputs: Array<HardwareDatapoint>,
    outputs: Array<HardwareDatapoint>
  ) {
    const portGroupsMap = new Map<string, PortGroup>(
      portGroups.map((pg) => [pg.name, pg])
    );
    for (const datapoint of datapoints) {
      const portgroup =
        datapoint.portgroup?.ref &&
        portGroupsMap.get(datapoint.portgroup.ref.name);
      if (!portgroup) continue;
      const isInput =
        portgroup.ioType === "DIGITAL_INPUT" ||
        portgroup.ioType === "ANALOG_INPUT";
      this.processChannels(datapoint, isInput, inputs, outputs);
    }
  }

  private processChannels(
    datapoint: Datapoint,
    isInput: boolean,
    inputs: Array<HardwareDatapoint>,
    outputs: Array<HardwareDatapoint>
  ) {
    for (const channel of datapoint.channels) {
      const varName = `${datapoint.name}_${channel.name}`;
      let channelDataType: string;
      switch (channel.dataType) {
        case "BOOL":
          channelDataType = "BOOL";
          break;
        case "INT":
          channelDataType = "INT";
          break;
        case "REAL":
          channelDataType = "REAL";
          break;
        default:
          channelDataType = "BYTE";
      }
      if (isInput) {
        inputs.push({ name: varName, type: channelDataType });
      } else {
        outputs.push({ name: varName, type: channelDataType });
      }
    }
  }

  getDefaultIOType(plcType: string): string {
    switch (plcType) {
      case "BOOL":
        return "X"; // Single bit
      case "BYTE":
        return "B"; // 8 bits
      case "WORD":
      case "INT":
        return "W"; // 16 bits
      case "DWORD":
      case "DINT":
      case "REAL":
        return "D"; // 32 bits
      case "LWORD":
      case "LINT":
      case "LREAL":
        return "L"; // 64 bits
      default:
        return "B"; // Default to byte
    }
  }

  generateBeckhoffArtifacts(): {
    files: string[];
    csharpStrings: Record<
      string,
      { declaration: string; implementation?: string }
    >;
  } {
    const files: string[] = [];

    files.push(...this.writeProgramMain());

    for (const item of this.controlModel.controlBlock.items) {
      if ("isExtern" in item && item.isExtern) continue;
      if (isEnumDecl(item)) {
        files.push(this.writeEnum(item));
      } else if (isStructDecl(item)) {
        files.push(this.writeStruct(item));
      } else if (isFunctionBlockDecl(item)) {
        files.push(...this.writeFunctionBlock(item));
      }
    }

    function createCSharpString(filePath: string): string {
      return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\\r\\n");
    }

    const csharpStrings: Record<
      string,
      { declaration: string; implementation?: string }
    > = {};

    // Process each item in the control model to create C# ready strings
    for (const item of this.controlModel.controlBlock.items) {
      if ("isExtern" in item && item.isExtern) continue;
      if (isEnumDecl(item)) {
        const filePath = path.join(
          this.destination,
          "Enums",
          `${item.name}.st`
        );
        csharpStrings[item.name] = {
          declaration: createCSharpString(filePath),
        };
      } else if (isStructDecl(item)) {
        const filePath = path.join(
          this.destination,
          "Structs",
          `${item.name}.st`
        );
        csharpStrings[item.name] = {
          declaration: createCSharpString(filePath),
        };
      } else if (isFunctionBlockDecl(item)) {
        const declFilePath = path.join(
          this.destination,
          "FunctionBlocks",
          `${item.name}_decl.st`
        );
        const implFilePath = path.join(
          this.destination,
          "FunctionBlocks",
          `${item.name}_impl.st`
        );

        csharpStrings[item.name] = {
          declaration: createCSharpString(declFilePath),
          implementation: createCSharpString(implFilePath),
        };
      }
    }

    // Add MAIN program
    const mainDeclFilePath = path.join(this.destination, `MAIN_decl.st`);
    const mainImplFilePath = path.join(this.destination, `MAIN_impl.st`);

    csharpStrings["MAIN"] = {
      declaration: createCSharpString(mainDeclFilePath),
      implementation: createCSharpString(mainImplFilePath),
    };

    // --- Write tc-config.json ---
    const tcConfigJson = this.tcConfigGenerator.generateTcConfigJson();
    const tcConfigJsonPath = path.join(this.destination, "tc-config.json");
    fs.writeFileSync(tcConfigJsonPath, JSON.stringify(tcConfigJson, null, 2));
    files.push(tcConfigJsonPath);
    csharpStrings["tc-config"] = {
      declaration: JSON.stringify(tcConfigJson, null, 2),
    };

    return { files, csharpStrings };
  }
}

export function generate(
  controlModel: ControlModel,
  hardwareModel: HardwareModel,
  destination: string
) {
  const ctx = new BeckhoffGeneratorContext(
    controlModel,
    hardwareModel,
    destination
  );
  return ctx.generateBeckhoffArtifacts();
}

class EmittedVarDecl {
  varDecl: VarDecl;
  controlUnit?: ControlUnit;

  constructor(varDecl: VarDecl, controlUnit?: ControlUnit) {
    this.varDecl = varDecl;
    this.controlUnit = controlUnit;
  }

  get name(): string {
    if (this.controlUnit) {
      return `${this.controlUnit.name}_${this.varDecl.name}`;
    }
    return `${this.varDecl.name}`;
  }
}

function convertTypeRefToST(typeRef: TypeRef): string {
  if (typeRef.type) {
    if (typeRef.sizes.length === 0) {
      return typeRef.type;
    } else {
      return `ARRAY [${typeRef.sizes
        .map((size) => {
          if (isPrimary(size) && typeof size.val === "number") {
            return `0..${size.val - 1}`;
          }
          return "0..?";
        })
        .join(", ")}] OF ${typeRef.type}`;
    }
  } else if (typeRef.ref) {
    const typeDecl = typeRef.ref.ref;
    const typeName = typeDecl && "name" in typeDecl ? typeDecl.name : "UNKNOWN";
    if (typeRef.sizes.length === 0) {
      return typeName as string;
    } else {
      return `ARRAY [${typeRef.sizes
        .map((size) => {
          if (isPrimary(size) && typeof size.val === "number") {
            return `0..${size.val - 1}`;
          }
          return "0..?";
        })
        .join(", ")}] OF ${typeName}`;
    }
  }
  return "UNKNOWN_TYPE";
}

/**
 * Handles special input mapping and constructor logic libraries (e.g., DALI, others in future).
 * Returns an object with possibly modified inputMappings and constructorArgs for declaration.
 */
function handleLibrarySpecials(
  fbType: string,
  inputMappings: string,
  context: BeckhoffGeneratorContext
): { inputMappings: string; constructorArgs?: string } {
  // DALI special handling
  if (fbType.startsWith("FB_DALI")) {
    const daliComType = detectDaliComType(context.hardwareModel);
    if (!daliComType) {
      throw new Error(
        "DALI communication moduleType not found in hardware. Please declare a portgroup with a supported DALI moduleType (e.g., KL6811, KL6821, EL6821) to use FB_DALI function blocks."
      );
    }
    const key = `daliCom_${daliComType}`;
    const daliComInstance = context.fbInstanceMap.get(key);
    if (!daliComInstance) {
      throw new Error("DALI communication FB instance was not generated.");
    }
    // Only set constructorArgs, do NOT prepend to inputMappings
    if (daliComInstance.kind === "fb") {
      return {
        inputMappings,
        constructorArgs: daliComInstance.instanceName,
      };
    } else {
      throw new Error("DALI communication FB instance is not of FB kind.");
    }
  }
  // Add more library-specific handling here as needed
  return { inputMappings };
}
