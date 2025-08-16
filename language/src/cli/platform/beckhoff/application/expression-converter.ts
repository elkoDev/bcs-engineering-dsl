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
 * Handles conversion of expressions to Structured Text
 */
export class ExpressionConverter {
  private hardwareChannelFlatNames: Set<string>;

  constructor(hardwareChannelFlatNames: Set<string>) {
    this.hardwareChannelFlatNames = hardwareChannelFlatNames;
  }

  updateHardwareChannelFlatNames(names: Set<string>) {
    this.hardwareChannelFlatNames = names;
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
    if (this.isPrimitive(expr)) return this.primitiveToST(expr.val);
    return "UNKNOWN_PRIMARY_EXPR";
  }

  // Helper function to check if a node is a primitive value
  private isPrimitive(expr: Primary): boolean {
    return (
      typeof expr.val === "number" ||
      typeof expr.val === "string" ||
      typeof expr.val === "boolean"
    );
  }

  /**
   * Translate operators from DSL to ST format
   */
  private translateOperator(op: string): string {
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
    const op = this.translateOperator(expr.op);
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
      let result = getQualifiedReferenceName(expr.ref);
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

  private primitiveToST(val: any): string {
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
}
