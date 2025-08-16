import {
  getQualifiedReferenceName,
  getReferenceName,
} from "./qualified_reference_name.js";
import {
  Expr,
  isPrimary,
  isBinExpr,
  Primary,
  isRef,
  isParenExpr,
  isNegExpr,
  isNotExpr,
  isArrayLiteral,
  isStructLiteral,
  Ref,
} from "../../../../language/generated/ast.js";

/**
 * Renders DSL expressions (Expr) to IEC 61131-3 Structured Text.
 */
export class ExpressionConverter {
  private hardwareChannelSymbols: Set<string>;

  constructor(hardwareChannelSymbols: Set<string>) {
    this.hardwareChannelSymbols = hardwareChannelSymbols;
  }

  /** Replace the known set of flattened I/O channel symbols. */
  public setHardwareChannelSymbols(names: Iterable<string>): void {
    this.hardwareChannelSymbols = new Set(names);
  }

  /** Public entrypoint: render any Expr to ST. */
  public emit(expr: Expr): string {
    if (isPrimary(expr)) return this.emitPrimary(expr);
    if (isBinExpr(expr)) return this.emitBinary(expr);
    return "UNKNOWN_EXPR";
  }

  // ── Primary forms ────────────────────────────────────────────────────────────

  private emitPrimary(expr: Primary): string {
    if (expr.isNow) return "todNow";
    if (isRef(expr)) return this.emitRef(expr);
    if (isParenExpr(expr)) return this.emitParen(expr);
    if (isNegExpr(expr)) return this.emitNeg(expr);
    if (isNotExpr(expr)) return this.emitNot(expr);
    if (isArrayLiteral(expr.val)) return this.emitArrayLiteral(expr);
    if (isStructLiteral(expr.val)) return this.emitStructLiteral(expr);
    if (this.isLiteral(expr)) return this.emitLiteral(expr.val);
    return "UNKNOWN_PRIMARY_EXPR";
  }

  /** Numbers / strings / booleans inline in the AST. */
  private isLiteral(expr: Primary): boolean {
    return (
      typeof expr.val === "number" ||
      typeof expr.val === "string" ||
      typeof expr.val === "boolean"
    );
  }

  // ── Operators & simple wrappers ─────────────────────────────────────────────

  private static readonly OP: Record<string, string> = {
    "&&": "AND",
    "||": "OR",
    "==": "=",
    "!=": "<>",
  };

  private mapOperator(op: string): string {
    return ExpressionConverter.OP[op] ?? op;
  }

  private emitParen(expr: { expr: Expr }): string {
    return `(${this.emit(expr.expr)})`;
  }

  private emitNeg(expr: { expr: Expr }): string {
    return `-${this.emit(expr.expr)}`;
  }

  private emitNot(expr: { expr: Expr }): string {
    return `NOT ${this.emit(expr.expr)}`;
  }

  private emitBinary(expr: { e1: Expr; e2: Expr; op: string }): string {
    const op = this.mapOperator(expr.op);
    return `${this.emit(expr.e1)} ${op} ${this.emit(expr.e2)}`;
  }

  // ── Literals ────────────────────────────────────────────────────────────────

  private emitArrayLiteral(expr: any): string {
    // Flatten nested arrays element-wise
    const flat = expr.val.elements.flatMap((e: Expr) => {
      if (isPrimary(e) && isArrayLiteral(e.val)) {
        return e.val.elements.map((n: Expr) => this.emit(n));
      }
      return [this.emit(e)];
    });
    return `[${flat.join(", ")}]`;
  }

  private emitStructLiteral(expr: any): string {
    const parts = expr.val.fields.map(
      (f: any) => `${f.name}:=${this.emit(f.value)}`
    );
    return `(${parts.join(", ")})`;
  }

  private emitLiteral(val: any): string {
    if (typeof val === "string") {
      // Pass through TOD literals; quote everything else
      return /TOD#[0-9:]+/.test(val) ? val : `'${val.replaceAll('"', "")}'`;
    }
    if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
    return val !== undefined ? String(val) : "";
  }

  // ── References (variables, datapoints, members, indices) ───────────────────

  private emitRef(expr: Ref): string {
    // Fast path: Datapoint.Channel flattened to a known I/O symbol
    if (expr.ref && expr.properties?.length === 1) {
      const flat = `${getReferenceName(expr.ref)}_${getReferenceName(
        expr.properties[0]
      )}`;
      if (this.hardwareChannelSymbols.has(flat)) return flat;
    }

    // General case: qualified variable + optional indices + member chain
    if (expr.ref) {
      let out = getQualifiedReferenceName(expr.ref);

      if (expr.indices?.length) {
        out += `[${expr.indices.map((i) => this.emit(i)).join(", ")}]`;
      }
      if (expr.properties?.length) {
        out += `.${expr.properties.map(getReferenceName).join(".")}`;
      }
      return out;
    }

    return "UNKNOWN_REF";
  }
}
