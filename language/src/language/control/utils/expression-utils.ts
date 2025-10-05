/**
 * Utility class for working with expressions in the BCS control language.
 * Contains methods for stringifying expressions and manipulating expression data.
 */
export class ExpressionUtils {
  public static stringifyExpression(expr: any): string {
    if (!expr) return "undefined";

    switch (expr.$type) {
      case "BinExpr":
        return `${this.stringifyExpression(expr.e1)} ${
          expr.op
        } ${this.stringifyExpression(expr.e2)}`;
      case "NegExpr":
        return `-${this.stringifyExpression(expr.expr)}`;
      case "NotExpr":
        return `!${this.stringifyExpression(expr.expr)}`;
      case "ParenExpr":
        return `(${this.stringifyExpression(expr.expr)})`;
      case "Ref":
        return expr.ref?.ref?.name ?? "[unresolved ref]";
      case "EnumMemberLiteral":
        return `${expr.value.ref?.name}.${expr.member.ref?.name}`;

      case "Primary":
        if (expr.val) {
          if (this.isArrayLiteral(expr)) {
            return `[${expr.val.elements
              .map((e: any) => this.stringifyExpression(e))
              .join(", ")}]`;
          }
          if (this.isStructLiteral(expr)) {
            return `{${expr.val.fields
              .map(
                (f: any) => `${f.name}: ${this.stringifyExpression(f.value)}`
              )
              .join(", ")}}`;
          }
          return `${expr.val}`;
        }
        return "[Primary]";

      default:
        return `[${expr.$type}]`;
    }
  }

  private static isArrayLiteral(expr: any): boolean {
    return expr?.$type === "Primary" && Array.isArray(expr.val?.elements);
  }

  private static isStructLiteral(expr: any): boolean {
    return expr?.$type === "Primary" && Array.isArray(expr.val?.fields);
  }
}
