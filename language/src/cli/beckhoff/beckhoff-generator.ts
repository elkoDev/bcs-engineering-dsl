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
  isWaitStmt,
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
} from "../../language/generated/ast.js";
import { expandToNode, joinToNode, toString } from "langium/generate";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  getInputs,
  getOutputs,
  getLocals,
  getLogic,
} from "../../language/utils/function-block-utils.js";
import { Reference } from "langium";
import { detectDaliComType } from "./beckhoff-utils.js";

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

// Add a type for FB instance info
interface FBInstanceInfo {
  instanceName: string;
  fbType: string;
}

class BeckhoffGeneratorContext {
  hardwareChannelFlatNames: Set<string>;
  fbInstanceMap: Map<any, FBInstanceInfo>; // Key: UseStmt or edge key, Value: FBInstanceInfo
  fbInstanceCounter: number;
  controlModel: ControlModel;
  hardwareModel: HardwareModel;
  destination: string;

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
  }

  // Generate a globally unique FB instance name
  createUniqueFBInstanceName(fbType: string): string {
    const name = `${fbType.charAt(0).toLowerCase()}${fbType.slice(1)}Instance${this.fbInstanceCounter}`;
    this.fbInstanceCounter++;
    return name;
  }

  // Assign or get a unique FB instance for a UseStmt
  getOrAssignFBInstance(useStmt: UseStmt): FBInstanceInfo {
    if (this.fbInstanceMap.has(useStmt)) {
      return this.fbInstanceMap.get(useStmt)!;
    }
    const fbType = useStmt.functionBlockRef.ref?.name ?? "UNKNOWN_FB";
    const instanceName = this.createUniqueFBInstanceName(fbType);
    const info: FBInstanceInfo = { instanceName, fbType };
    this.fbInstanceMap.set(useStmt, info);
    return info;
  }

  // Assign or get a unique FB instance for edge detection
  getOrAssignEdgeFBInstance(type: "rising" | "falling", signalExpr: string, index: number, fbType: string): FBInstanceInfo {
    const key = `${type}_${signalExpr}_${index}`;
    if (this.fbInstanceMap.has(key)) {
      return this.fbInstanceMap.get(key)!;
    }
    const instanceName = this.createUniqueFBInstanceName(fbType);
    const info: FBInstanceInfo = { instanceName, fbType };
    this.fbInstanceMap.set(key, info);
    return info;
  }

  // Get all instance declarations for main program
  getAllFBInstanceDeclarations(): Array<{ instanceName: string; fbType: string }> {
    // Use a Set to avoid duplicates if the same instance is referenced by multiple keys
    const seen = new Set<string>();
    const result: Array<{ instanceName: string; fbType: string }> = [];
    for (const { instanceName, fbType } of this.fbInstanceMap.values()) {
      if (!seen.has(instanceName)) {
        seen.add(instanceName);
        result.push({ instanceName, fbType });
      }
    }
    return result;
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

  private convertPrimaryExprToST(expr: any): string {
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
    if (typeof val === "string") return `'${val.replaceAll('"', "")}'`;
    if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
    if (val !== undefined) return val.toString();
    return "";
  }

  convertStatementToST(
    stmt: Statement,
    edgeMetadata?: [string, number],
    indent: number = 0,
    mainStatements?: Statement[]
  ): string {
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
    if (isWaitStmt(stmt))
      return (
        pad(indent) +
        `// Wait statements are not directly supported in ST - using equivalent timer logic`
      );
    if (isBreakStmt(stmt)) return pad(indent) + `EXIT;`;
    if (isContinueStmt(stmt)) return pad(indent) + `CONTINUE;`;
    if (isExpressionStmt(stmt))
      return pad(indent) + `${this.convertExprToST(stmt.expr)};`;
    if (isUseStmt(stmt)) return this.stUse(stmt, indent);
    if (isOnRisingEdgeStmt(stmt))
      return this.stEdge(stmt, edgeMetadata, indent, true, mainStatements);
    if (isOnFallingEdgeStmt(stmt))
      return this.stEdge(stmt, edgeMetadata, indent, false, mainStatements);
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
        .map((s: any) => this.convertStatementToST(s, undefined, indent + 1))
        .join("\n") + "\n";
    for (const elseIfStmt of stmt.elseIfStmts) {
      result +=
        pad(indent) +
        `ELSIF ${this.convertExprToST(elseIfStmt.condition)} THEN\n`;
      result +=
        elseIfStmt.stmts
          .map((s: any) => this.convertStatementToST(s, undefined, indent + 1))
          .join("\n") + "\n";
    }
    if (stmt.elseStmt) {
      result += pad(indent) + `ELSE\n`;
      result +=
        (stmt.elseStmt.stmts || [])
          .map((s: any) => this.convertStatementToST(s, undefined, indent + 1))
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
        .map((subStmt: any) =>
          this.convertStatementToST(subStmt, undefined, indent + 1)
        )
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
        .map((s: any) => this.convertStatementToST(s, undefined, indent + 1))
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
          .map((subStmt: any) =>
            this.convertStatementToST(subStmt, undefined, indent + 2)
          )
          .join("\n") + "\n";
    }
    if (stmt.default) {
      result += `${pad(indent + 1)}ELSE\n`;
      result +=
        stmt.default.stmts
          .map((subStmt: any) =>
            this.convertStatementToST(subStmt, undefined, indent + 2)
          )
          .join("\n") + "\n";
    }
    result += `${pad(indent)}END_CASE;`;
    return result;
  }

  stUse(stmt: any, indent: number): string {
    return this.convertUseStmtToST(stmt);
  }

  stEdge(
    stmt: any,
    edgeMetadata: [string, number] | undefined,
    indent: number,
    rising: boolean,
    mainStatements?: Statement[]
  ): string {
    const type = rising ? "rising" : "falling";
    const edgeStatements = (mainStatements ?? []).filter(
      rising ? isOnRisingEdgeStmt : isOnFallingEdgeStmt
    );
    const statementIndex = edgeStatements.indexOf(stmt);
    if (statementIndex !== -1) {
      return this.convertEdgeDetectionToST(stmt, statementIndex, type, indent);
    }
    return this.convertStatementToST(stmt, edgeMetadata, indent);
  }

  convertEdgeDetectionToST(
    stmt: Statement,
    index: number,
    type: "rising" | "falling",
    indent: number = 0
  ): string {
    const pad = (level: number) => "    ".repeat(level);
    if (type === "rising" && isOnRisingEdgeStmt(stmt)) {
      const signalExpr = this.convertExprToST(stmt.signal);
      const { instanceName } = this.getOrAssignEdgeFBInstance("rising", signalExpr, index, "R_TRIG");
      let risingContent = `${pad(indent)}// Rising edge detection for ${signalExpr}\n`;
      risingContent += `${pad(indent)}${instanceName}(CLK := ${signalExpr});\n`;
      risingContent += `${pad(indent)}IF ${instanceName}.Q THEN\n`;
      for (const subStmt of stmt.stmts) {
        risingContent +=
          this.convertStatementToST(subStmt, undefined, indent + 1) + "\n";
      }
      risingContent += `${pad(indent)}END_IF;`;
      return risingContent;
    } else if (type === "falling" && isOnFallingEdgeStmt(stmt)) {
      const signalExpr = this.convertExprToST(stmt.signal);
      const { instanceName } = this.getOrAssignEdgeFBInstance("falling", signalExpr, index, "F_TRIG");
      let fallingContent = `${pad(indent)}// Falling edge detection for ${signalExpr}\n`;
      fallingContent += `${pad(indent)}${instanceName}(CLK := ${signalExpr});\n`;
      fallingContent += `${pad(indent)}IF ${instanceName}.Q THEN\n`;
      for (const subStmt of stmt.stmts) {
        fallingContent +=
          this.convertStatementToST(subStmt, undefined, indent + 1) + "\n";
      }
      fallingContent += `${pad(indent)}END_IF;`;
      return fallingContent;
    }
    return "// Error: Invalid edge detection statement";
  }

  convertUseStmtToST(stmt: UseStmt): string {
    let useContent = "";
    const { instanceName, fbType } = this.getOrAssignFBInstance(stmt);
    // Map inputs
    const inputMappings = stmt.inputArgs
      .map((arg) => {
        return `${arg.inputVar.ref?.name}:=${this.convertExprToST(arg.value)}`;
      })
      .join(", ");
    // Handle output mapping
    if (stmt.useOutput.singleOutput) {
      const targetOutputVarRef = stmt.useOutput.singleOutput.targetOutputVar;
      const targetOutputVarName = this.getQualifiedReferenceName(targetOutputVarRef);
      useContent += `${instanceName} := ${fbType}(${inputMappings});\n`;
      useContent += `${targetOutputVarName} := ${instanceName};`;
    } else if (stmt.useOutput.mappingOutputs.length > 0) {
      useContent += `${instanceName}(${inputMappings});\n`;
      for (const outMapping of stmt.useOutput.mappingOutputs) {
        const targetOutputVarRef = outMapping.targetOutputVar;
        const targetOutputVarName = this.getQualifiedReferenceName(targetOutputVarRef);
        const fbOutputVarName = outMapping.fbOutputVar.ref?.name ?? "output";
        useContent += `${targetOutputVarName} := ${instanceName}.${fbOutputVarName};\n`;
      }
    } else {
      useContent += `${instanceName}(${inputMappings});\n`;
    }
    return useContent;
  }

  generateBeckhoffArtifacts(): string[] {
    if (!fs.existsSync(this.destination))
      fs.mkdirSync(this.destination, { recursive: true });
    const files: string[] = [];

    for (const item of this.controlModel.controlBlock.items) {
      // Skip items marked as extern
      if (isEnumDecl(item) || isStructDecl(item) || isFunctionBlockDecl(item)) {
        if (item.isExtern) continue;
      }

      if (isEnumDecl(item)) files.push(this.writeEnum(item));
      else if (isStructDecl(item)) files.push(this.writeStruct(item));
      else if (isFunctionBlockDecl(item))
        files.push(...this.writeFunctionBlock(item));
    }

    files.push(this.writeProgramMain());
    return files;
  }

  writeEnum(enumDecl: EnumDecl): string {
    const filePath = path.join(this.destination, `${enumDecl.name}.st`);

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
    const filePath = path.join(this.destination, `${structDecl.name}.st`);

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
    const declFilePath = path.join(this.destination, `${fbDecl.name}_decl.st`);
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
    const implFilePath = path.join(this.destination, `${fbDecl.name}_impl.st`);
    const implContent = (logic?.stmts || [])
      .map((stmt) => this.convertStatementToST(stmt, undefined, 0).trimEnd())
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

  writeProgramMain(): string {
    this.fbInstanceMap.clear();
    this.fbInstanceCounter = 1;

    const mainVars: EmittedVarDecl[] = [];
    const mainStatements: Statement[] = [];

    this.collectGlobalVarDecls(mainVars);

    this.processControlUnits(mainVars, mainStatements);

    this.addRequiredAdditionalFBInstances(); // TODO: not working yet

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

    const fbInstanceDecls = this.getAllFBInstanceDeclarations();

    const declContent = this.generateMainDeclContent(
      inputs,
      outputs,
      mainVars,
      loopVarsToDeclare,
      fbInstanceDecls
    );
    const implContent = this.generateMainImplContent(mainStatements);

    const declFilePath = path.join(this.destination, `MAIN_decl.st`);
    fs.writeFileSync(declFilePath, declContent);
    const implFilePath = path.join(this.destination, `MAIN_impl.st`);
    fs.writeFileSync(implFilePath, implContent);
    return implFilePath;
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
    const daliComType = detectDaliComType(this.hardwareModel);
    if (daliComType) {
      // Add to fbInstanceMap if needed
      const fbType = daliComType;
      // Use a synthetic key for this special instance
      const key = `daliCom_${fbType}`;
      if (!this.fbInstanceMap.has(key)) {
        const instanceName = this.createUniqueFBInstanceName(fbType);
        this.fbInstanceMap.set(key, { instanceName, fbType });
      }
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

  private assignEdgeDetectionInstances(
    mainStatements: Statement[]
  ) {
    const risingEdgeStatements = mainStatements.filter(isOnRisingEdgeStmt);
    const fallingEdgeStatements = mainStatements.filter(isOnFallingEdgeStmt);
    risingEdgeStatements.forEach((stmt, index) => {
      const signalExpr = this.convertExprToST(stmt.signal);
      this.getOrAssignEdgeFBInstance("rising", signalExpr, index, "R_TRIG");
    });
    fallingEdgeStatements.forEach((stmt, index) => {
      const signalExpr = this.convertExprToST(stmt.signal);
      this.getOrAssignEdgeFBInstance("falling", signalExpr, index, "F_TRIG");
    });
  }

  private generateMainDeclContent(
    inputs: Array<{ name: string; type: string; ioBinding: string }>,
    outputs: Array<{ name: string; type: string; ioBinding: string }>,
    mainVars: EmittedVarDecl[],
    loopVarsToDeclare: [string, { type: string; init?: Expr }][],
    fbInstanceDecls: Array<{ instanceName: string; fbType: string }>
  ): string {
    return toString(
      expandToNode`
        PROGRAM MAIN
        VAR
            ${joinToNode(
              inputs,
              (input) => expandToNode`
                ${input.name} AT ${input.ioBinding.substring(0, 2)}*: ${
                input.type
              }; (* Input channel from hardware *)
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            ${joinToNode(
              outputs,
              (output) => expandToNode`
                ${output.name} AT ${output.ioBinding.substring(0, 2)}*: ${
                output.type
              }; (* Output channel to hardware *)
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
              ({ instanceName, fbType }) => expandToNode`
                ${instanceName}: ${fbType}; (* Function block instance *)
              `,
              { appendNewLineIfNotEmpty: true }
            )}
            bRunOnlyOnce: BOOL := FALSE;
        END_VAR
      `
    );
  }

  private generateMainImplContent(mainStatements: Statement[]): string {
    const risingEdgeStatements = mainStatements.filter(isOnRisingEdgeStmt);
    const fallingEdgeStatements = mainStatements.filter(isOnFallingEdgeStmt);
    return toString(
      expandToNode`
        // Initialize code - runs only once
        IF NOT bRunOnlyOnce THEN
            ADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_LOG,  
                     msgFmtStr := 'Program started %s', 
                     strArg := 'successfully!');
            bRunOnlyOnce := TRUE;
        END_IF

        // Main program logic
        ${joinToNode(
          mainStatements.filter((stmt) => !isVarDecl(stmt)),
          (stmt, index) => {
            if (isOnRisingEdgeStmt(stmt)) {
              const statementIndex = risingEdgeStatements.indexOf(stmt);
              if (statementIndex !== -1) {
                return this.convertEdgeDetectionToST(
                  stmt,
                  statementIndex,
                  "rising"
                );
              }
            } else if (isOnFallingEdgeStmt(stmt)) {
              const statementIndex = fallingEdgeStatements.indexOf(stmt);
              if (statementIndex !== -1) {
                return this.convertEdgeDetectionToST(
                  stmt,
                  statementIndex,
                  "falling"
                );
              }
            } else if (isUseStmt(stmt)) {
              return this.convertUseStmtToST(stmt);
            }
            return this.convertStatementToST(
              stmt,
              undefined,
              0,
              mainStatements
            );
          },
          { appendNewLineIfNotEmpty: true }
        )}
      `
    );
  }

  extractHardwareDatapoints(): {
    inputs: Array<{ name: string; type: string; ioBinding: string }>;
    outputs: Array<{ name: string; type: string; ioBinding: string }>;
  } {
    const inputs: Array<{ name: string; type: string; ioBinding: string }> = [];
    const outputs: Array<{ name: string; type: string; ioBinding: string }> =
      [];
    for (const controller of this.hardwareModel.controllers) {
      if (controller.platform !== "Beckhoff") continue;
      const portGroups = this.collectPortGroups(controller.components);
      this.processDatapoints(
        controller.components,
        portGroups,
        inputs,
        outputs
      );
    }
    return { inputs, outputs };
  }

  private collectPortGroups(components: any[]): Map<string, any> {
    const portGroups = new Map();
    for (const component of components) {
      if ("moduleType" in component) {
        portGroups.set(component.name, component);
      }
    }
    return portGroups;
  }

  private processDatapoints(
    components: any[],
    portGroups: Map<string, any>,
    inputs: Array<{ name: string; type: string; ioBinding: string }>,
    outputs: Array<{ name: string; type: string; ioBinding: string }>
  ) {
    for (const component of components) {
      if ("portgroup" in component) {
        const datapoint = component;
        const portgroup = portGroups.get(datapoint.portgroup.ref?.name);
        if (!portgroup) continue;
        const isInput =
          portgroup.ioType === "DIGITAL_INPUT" ||
          portgroup.ioType === "ANALOG_INPUT";
        this.processChannels(datapoint, portgroup, isInput, inputs, outputs);
      }
    }
  }

  private processChannels(
    datapoint: any,
    portgroup: any,
    isInput: boolean,
    inputs: Array<{ name: string; type: string; ioBinding: string }>,
    outputs: Array<{ name: string; type: string; ioBinding: string }>
  ) {
    for (const channel of datapoint.channels) {
      const varName = `${datapoint.name}_${channel.name}`;
      let plcType: string;
      switch (channel.dataType) {
        case "BOOL":
          plcType = "BOOL";
          break;
        case "INT":
          plcType = "INT";
          break;
        case "REAL":
          plcType = "REAL";
          break;
        default:
          plcType = "BYTE";
      }
      const addrMatch = portgroup.startAddress?.match(
        /([IQ])([XBWDL])?(\d+(\.\d+)?)?/
      );
      if (!addrMatch) continue;
      const ioPrefix = addrMatch[1];
      const ioType = addrMatch[2] ?? this.getDefaultIOType(plcType);
      const ioBaseAddr = addrMatch[3] ? parseInt(addrMatch[3]) : 0;
      const offsetAddr = ioBaseAddr + channel.index;
      const ioBinding = `%${ioPrefix}${ioType}${offsetAddr}`;
      if (isInput) {
        inputs.push({ name: varName, type: plcType, ioBinding });
      } else {
        outputs.push({ name: varName, type: plcType, ioBinding });
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

  generate(): {
    files: string[];
    csharpStrings: Record<
      string,
      { declaration: string; implementation?: string }
    >;
  } {
    const files = this.generateBeckhoffArtifacts();

    function createCSharpString(filePath: string): string {
      return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\\r\\n");
    }

    // Create C#-compatible strings for each POU
    const csharpStrings: Record<
      string,
      { declaration: string; implementation?: string }
    > = {};

    // Process each item in the control model to create C# ready strings
    for (const item of this.controlModel.controlBlock.items) {
      if ("isExtern" in item && item.isExtern) continue;
      if (isEnumDecl(item) || isStructDecl(item)) {
        const filePath = path.join(this.destination, `${item.name}.st`);
        csharpStrings[item.name] = {
          declaration: createCSharpString(filePath),
        };
      } else if (isFunctionBlockDecl(item)) {
        const declFilePath = path.join(
          this.destination,
          `${item.name}_decl.st`
        );
        const implFilePath = path.join(
          this.destination,
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

    return { files, csharpStrings };
  }
}

export function generateBeckhoffCode(
  controlModel: ControlModel,
  hardwareModel: HardwareModel,
  destination: string
) {
  const ctx = new BeckhoffGeneratorContext(
    controlModel,
    hardwareModel,
    destination
  );
  return ctx.generate();
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
