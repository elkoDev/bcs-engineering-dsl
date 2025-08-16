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
import { GlobalInstanceManager } from "./global-instance-manager.js";
import { getQualifiedReferenceName } from "./qualified_reference_name.js";

/**
 * Converts DSL statements to IEC 61131-3 Structured Text and analyzes statement structures.
 */
export class StatementConverter {
  constructor(
    private readonly expr: ExpressionConverter,
    private readonly instances: GlobalInstanceManager
  ) {}

  /** Renders a Statement to ST. */
  public emit(stmt: Statement, indent = 0): string {
    if (isAssignmentStmt(stmt)) return this.emitAssign(stmt, indent);
    if (isIfStmt(stmt)) return this.emitIf(stmt, indent);
    if (isWhileStmt(stmt)) return this.emitWhile(stmt, indent);
    if (isForStmt(stmt)) return this.emitFor(stmt, indent);
    if (isSwitchStmt(stmt)) return this.emitSwitch(stmt, indent);
    if (isAfterStmt(stmt)) return this.emitAfter(stmt, indent);
    if (isUseStmt(stmt)) return this.emitUse(stmt, indent);
    if (isOnRisingEdgeStmt(stmt)) return this.emitEdge(stmt, "rising", indent);
    if (isOnFallingEdgeStmt(stmt))
      return this.emitEdge(stmt, "falling", indent);
    if (isBreakStmt(stmt)) return this.emitBreak(indent);
    if (isContinueStmt(stmt)) return this.emitContinue(indent);
    if (isExpressionStmt(stmt)) return this.emitExpression(stmt, indent);
    return this.emitUnsupported(stmt, indent);
  }

  // ── Emitters ────────────────────────────────────────────────────────────────

  private emitAssign(
    stmt: { target: Expr; value: Expr },
    indent: number
  ): string {
    return `${this.pad(indent)}${this.expr.emit(
      stmt.target
    )} := ${this.expr.emit(stmt.value)};`;
  }

  private emitIf(stmt: IfStmt, indent: number): string {
    let out = `${this.pad(indent)}IF ${this.expr.emit(stmt.condition)} THEN\n`;
    out += this.emitBlock(stmt.stmts, indent + 1);
    for (const e of stmt.elseIfStmts) {
      out += `\n${this.pad(indent)}ELSIF ${this.expr.emit(e.condition)} THEN\n`;
      out += this.emitBlock(e.stmts, indent + 1);
    }
    if (stmt.elseStmt) {
      out += `\n${this.pad(indent)}ELSE\n`;
      out += this.emitBlock(stmt.elseStmt.stmts, indent + 1);
    }
    return out + `\n${this.pad(indent)}END_IF;`;
  }

  private emitWhile(stmt: WhileStmt, indent: number): string {
    let out = `${this.pad(indent)}WHILE ${this.expr.emit(stmt.condition)} DO\n`;
    out += this.emitBlock(stmt.stmts, indent + 1);
    return out + `\n${this.pad(indent)}END_WHILE;`;
  }

  private emitFor(stmt: ForStmt, indent: number): string {
    const init = stmt.loopVar.init ? this.expr.emit(stmt.loopVar.init) : "0";
    const step = stmt.step ? ` BY ${this.expr.emit(stmt.step)}` : "";
    let out = `${this.pad(indent)}FOR ${
      stmt.loopVar.name
    } := ${init} TO ${this.expr.emit(stmt.toExpr)}${step} DO\n`;
    out += this.emitBlock(stmt.stmts, indent + 1);
    return out + `\n${this.pad(indent)}END_FOR;`;
  }

  private emitSwitch(stmt: SwitchStmt, indent: number): string {
    let out = `${this.pad(indent)}CASE ${this.expr.emit(stmt.expr)} OF\n`;
    for (const c of stmt.cases) {
      out += `${this.pad(indent + 1)}${this.emitCaseLiterals(c.literals)}:\n`;
      out += this.emitBlock(c.stmts, indent + 2) + "\n";
    }
    if (stmt.default) {
      out += `${this.pad(indent + 1)}ELSE\n`;
      out += this.emitBlock(stmt.default.stmts, indent + 2) + "\n";
    }
    return out + `${this.pad(indent)}END_CASE;`;
  }

  private emitUse(stmt: UseStmt, indent: number): string {
    const p = this.pad(indent);
    const { instanceName } = this.instances.getOrAssignFBInstance(stmt);
    const inputs = stmt.inputArgs
      .map((arg) => `${arg.inputVar.ref?.name}:=${this.expr.emit(arg.value)}`)
      .join(", ");
    let out = `${p}${instanceName}(${inputs});\n`;

    if (stmt.useOutput.singleOutput) {
      const fb = stmt.functionBlockRef.ref;
      const outs = fb ? getOutputs(fb) : [];
      const fbOut = outs.length === 1 ? outs[0].name : "output";
      const target = getQualifiedReferenceName(
        stmt.useOutput.singleOutput.targetOutputVar
      );
      return out + `${p}${target} := ${instanceName}.${fbOut};\n`;
    }

    for (const m of stmt.useOutput.mappingOutputs) {
      const target = getQualifiedReferenceName(m.targetOutputVar);
      const fbOut = m.fbOutputVar.ref?.name ?? "output";
      out += `${p}${target} := ${instanceName}.${fbOut};\n`;
    }
    return out;
  }

  private emitEdge(
    stmt: Statement,
    kind: "rising" | "falling",
    indent: number
  ): string {
    const isR = kind === "rising";
    if (isR && !isOnRisingEdgeStmt(stmt))
      return "// Error: Invalid rising-edge statement";
    if (!isR && !isOnFallingEdgeStmt(stmt))
      return "// Error: Invalid falling-edge statement";

    const signal = this.expr.emit((stmt as any).signal);
    const fbType = isR ? "R_TRIG" : "F_TRIG";
    const { instanceName } = this.instances.getOrAssignEdgeFBInstance(
      stmt,
      kind,
      fbType
    );

    let out = `${this.pad(indent)}${instanceName}(CLK := ${signal});\n`;
    out += `${this.pad(indent)}IF ${instanceName}.Q THEN\n`;
    out += this.emitBlock((stmt as any).stmts ?? [], indent + 1);
    return out + `\n${this.pad(indent)}END_IF;`;
  }

  private emitAfter(stmt: AfterStmt, indent: number): string {
    const { tonName } = this.instances.getOrAssignAfterStmtInstance(stmt);
    const cond = this.expr.emit((stmt as any).condition);
    let out = `${this.pad(indent)}${tonName}(IN := ${cond});\n`;
    out += `${this.pad(indent)}IF ${tonName}.Q THEN\n`;
    out += this.emitBlock((stmt as any).stmts ?? [], indent + 1);
    out += `\n${this.pad(indent + 1)}${tonName}(IN := FALSE);`;
    return out + `\n${this.pad(indent)}END_IF;\n`;
  }

  private emitBreak(indent: number): string {
    return this.pad(indent) + "EXIT;";
  }

  private emitContinue(indent: number): string {
    return this.pad(indent) + "CONTINUE;";
  }

  private emitExpression(stmt: { expr: Expr }, indent: number): string {
    return this.pad(indent) + this.expr.emit(stmt.expr) + ";";
  }

  private emitUnsupported(stmt: Statement, indent: number): string {
    return (
      this.pad(indent) + `// Unsupported statement type: ${(stmt as any).$type}`
    );
  }

  private emitBlock(stmts: Statement[], indent: number): string {
    return stmts.map((s) => this.emit(s, indent)).join("\n");
  }

  private emitCaseLiterals(lits: Array<{ val: unknown }>): string {
    return lits
      .map((lit) =>
        isEnumMemberLiteral((lit as any).val)
          ? `${(lit as any).val.enumDecl.ref?.name}.${
              (lit as any).val.member.ref?.name
            }`
          : String((lit as any).val)
      )
      .join(", ");
  }

  // ── Small utilities ─────────────────────────────────────────────────────────

  private pad(level: number): string {
    return "    ".repeat(level);
  }
}
