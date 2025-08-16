import { getOutputs } from "../../../../language/control/utils/function-block-utils.js";
import {
  Statement,
  isAssignmentStmt,
  isIfStmt,
  isWhileStmt,
  isForStmt,
  isSwitchStmt,
  isAfterStmt,
  isBreakStmt,
  isContinueStmt,
  isExpressionStmt,
  isUseStmt,
  isOnRisingEdgeStmt,
  isOnFallingEdgeStmt,
  IfStmt,
  WhileStmt,
  ForStmt,
  SwitchStmt,
  isEnumMemberLiteral,
  UseStmt,
  AfterStmt,
  Expr,
} from "../../../../language/generated/ast.js";
import { ExpressionConverter } from "./expression-converter.js";
import { InstanceManager } from "./instance-manager.js";
import { getQualifiedReferenceName } from "./qualified_reference_name.js";

/**
 * Converts DSL statements to IEC 61131-3 Structured Text and analyzes statement structures.
 */
export class StatementConverter {
  private readonly expressionConverter: ExpressionConverter;
  private readonly instanceManager: InstanceManager;

  constructor(
    expressionConverter: ExpressionConverter,
    instanceManager: InstanceManager
  ) {
    this.expressionConverter = expressionConverter;
    this.instanceManager = instanceManager;
  }

  /** Public entrypoint: convert any Statement to ST. */
  public emit(stmt: Statement, indent: number = 0): string {
    const pad = (level: number) => "    ".repeat(level);
    if (isAssignmentStmt(stmt))
      return (
        pad(indent) +
        `${this.expressionConverter.emit(
          stmt.target
        )} := ${this.expressionConverter.emit(stmt.value)};`
      );
    if (isIfStmt(stmt)) return this.stIf(stmt, indent);
    if (isWhileStmt(stmt)) return this.stWhile(stmt, indent);
    if (isForStmt(stmt)) return this.stFor(stmt, indent);
    if (isSwitchStmt(stmt)) return this.stSwitch(stmt, indent);
    if (isAfterStmt(stmt)) return this.stAfter(stmt, indent);
    if (isBreakStmt(stmt)) return pad(indent) + `EXIT;`;
    if (isContinueStmt(stmt)) return pad(indent) + `CONTINUE;`;
    if (isExpressionStmt(stmt))
      return pad(indent) + `${this.expressionConverter.emit(stmt.expr)};`;
    if (isUseStmt(stmt)) return this.stUse(stmt, indent);
    if (isOnRisingEdgeStmt(stmt)) return this.stEdge(stmt, indent, true);
    if (isOnFallingEdgeStmt(stmt)) return this.stEdge(stmt, indent, false);
    return (
      pad(indent) + `// Unsupported statement type: ${(stmt as any).$type}`
    );
  }

  /**
   * Public entrypoint: recursively collect all loop variables (from ForStmt) in a list of statements.
   */
  public collectLoopVars(
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

  private stIf(stmt: IfStmt, indent: number): string {
    const pad = (level: number) => "    ".repeat(level);
    let result =
      pad(indent) +
      `IF ${this.expressionConverter.emit(stmt.condition)} THEN\n`;
    result +=
      stmt.stmts.map((s: any) => this.emit(s, indent + 1)).join("\n") + "\n";
    for (const elseIfStmt of stmt.elseIfStmts) {
      result +=
        pad(indent) +
        `ELSIF ${this.expressionConverter.emit(elseIfStmt.condition)} THEN\n`;
      result +=
        elseIfStmt.stmts.map((s: any) => this.emit(s, indent + 1)).join("\n") +
        "\n";
    }
    if (stmt.elseStmt) {
      result += pad(indent) + `ELSE\n`;
      result +=
        (stmt.elseStmt.stmts || [])
          .map((s: any) => this.emit(s, indent + 1))
          .join("\n") + "\n";
    }
    result += pad(indent) + `END_IF;`;
    return result;
  }

  private stWhile(stmt: WhileStmt, indent: number): string {
    const pad = (level: number) => "    ".repeat(level);
    let result = `${pad(indent)}WHILE ${this.expressionConverter.emit(
      stmt.condition
    )} DO\n`;
    result +=
      stmt.stmts
        .map((subStmt: any) => this.emit(subStmt, indent + 1))
        .join("\n") + "\n";
    result += `${pad(indent)}END_WHILE;`;
    return result;
  }

  private stFor(stmt: ForStmt, indent: number): string {
    const pad = (level: number) => "    ".repeat(level);
    let result = `${pad(indent)}FOR ${stmt.loopVar.name} := ${
      stmt.loopVar.init ? this.expressionConverter.emit(stmt.loopVar.init) : "0"
    } TO ${this.expressionConverter.emit(stmt.toExpr)}${
      stmt.step ? ` BY ${this.expressionConverter.emit(stmt.step)}` : ""
    } DO\n`;
    result +=
      stmt.stmts.map((s: any) => this.emit(s, indent + 1)).join("\n") + "\n";
    result += `${pad(indent)}END_FOR;`;
    return result;
  }

  private stSwitch(stmt: SwitchStmt, indent: number): string {
    const pad = (level: number) => "    ".repeat(level);
    let result = `${pad(indent)}CASE ${this.expressionConverter.emit(
      stmt.expr
    )} OF\n`;
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
          .map((subStmt: any) => this.emit(subStmt, indent + 2))
          .join("\n") + "\n";
    }
    if (stmt.default) {
      result += `${pad(indent + 1)}ELSE\n`;
      result +=
        stmt.default.stmts
          .map((subStmt: any) => this.emit(subStmt, indent + 2))
          .join("\n") + "\n";
    }
    result += `${pad(indent)}END_CASE;`;
    return result;
  }

  private stUse(stmt: UseStmt, indent: number): string {
    const pad = (level: number) => "    ".repeat(level);
    let useContent = "";
    const { instanceName } = this.instanceManager.getOrAssignFBInstance(stmt);
    const inputMappings = stmt.inputArgs
      .map(
        (arg) =>
          `${arg.inputVar.ref?.name}:=${this.expressionConverter.emit(
            arg.value
          )}`
      )
      .join(", ");
    // Handle output mapping
    if (stmt.useOutput.singleOutput) {
      // Get the FB's only output variable name
      const fb = stmt.functionBlockRef.ref;
      const outputs = fb ? getOutputs(fb) : [];
      const fbOutputVarName = outputs.length === 1 ? outputs[0].name : "output";
      const targetOutputVarRef = stmt.useOutput.singleOutput.targetOutputVar;
      const targetOutputVarName = getQualifiedReferenceName(targetOutputVarRef);
      useContent += `${pad(indent)}${instanceName}(${inputMappings});\n`;
      useContent += `${pad(
        indent
      )}${targetOutputVarName} := ${instanceName}.${fbOutputVarName};\n`;
    } else if (stmt.useOutput.mappingOutputs.length > 0) {
      useContent += `${pad(indent)}${instanceName}(${inputMappings});\n`;
      for (const outMapping of stmt.useOutput.mappingOutputs) {
        const targetOutputVarRef = outMapping.targetOutputVar;
        const targetOutputVarName =
          getQualifiedReferenceName(targetOutputVarRef);
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

  private stEdge(stmt: any, indent: number, rising: boolean): string {
    const type = rising ? "rising" : "falling";
    return this.convertEdgeDetectionToST(stmt, type, indent);
  }

  private convertEdgeDetectionToST(
    stmt: Statement,
    type: "rising" | "falling",
    indent: number = 0
  ): string {
    const pad = (level: number) => "    ".repeat(level);
    if (type === "rising" && isOnRisingEdgeStmt(stmt)) {
      const signalExpr = this.expressionConverter.emit(stmt.signal);
      const { instanceName } = this.instanceManager.getOrAssignEdgeFBInstance(
        stmt,
        "rising",
        "R_TRIG"
      );
      let risingContent = `${pad(indent)}`;
      risingContent += `${pad(indent)}${instanceName}(CLK := ${signalExpr});\n`;
      risingContent += `${pad(indent)}IF ${instanceName}.Q THEN\n`;
      for (const subStmt of stmt.stmts) {
        risingContent += this.emit(subStmt, indent + 1) + "\n";
      }
      risingContent += `${pad(indent)}END_IF;`;
      return risingContent;
    } else if (type === "falling" && isOnFallingEdgeStmt(stmt)) {
      const signalExpr = this.expressionConverter.emit(stmt.signal);
      const { instanceName } = this.instanceManager.getOrAssignEdgeFBInstance(
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
        fallingContent += this.emit(subStmt, indent + 1) + "\n";
      }
      fallingContent += `${pad(indent)}END_IF;`;
      return fallingContent;
    }
    return "// Error: Invalid edge detection statement";
  }

  private stAfter(stmt: AfterStmt, indent: number): string {
    const pad = (level: number) => "    ".repeat(level);
    const { tonName } = this.instanceManager.getOrAssignAfterStmtInstance(stmt);
    const condition = this.expressionConverter.emit((stmt as any).condition);
    const blockStmts = (stmt as any).stmts ?? [];
    // Generate more concise logic: TON is enabled by condition, actions run when Q and condition, TON reset after
    return (
      `${pad(indent)}${tonName}(IN := ${condition});\n` +
      `${pad(indent)}IF ${tonName}.Q THEN\n` +
      blockStmts.map((s: any) => this.emit(s, indent + 1)).join("\n") +
      `\n${pad(indent + 1)}${tonName}(IN := FALSE);\n` +
      `${pad(indent)}END_IF;\n`
    );
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
}
