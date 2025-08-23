import { AstUtils, ValidationAcceptor } from "langium";
import {
  isControlModel,
  isStructDecl,
  isEnumDecl,
  isTypeAlias,
  isPrimary,
  isVarDecl,
  VarDecl,
  isFunctionBlockDecl,
  isChannel,
  isEnumMemberLiteral,
  isArrayLiteral,
  isStructLiteral,
  StructDecl,
} from "../../generated/ast.js";

/**
 * Main type inference engine that orchestrates all type inference operations.
 * This class consolidates the high-level type inference logic that was previously
 * scattered across the validator.
 */
export class TypeInferenceUtils {
  /**
   * Main type inference method - infers the type of any expression
   * @param expr The expression to analyze
   * @param accept Function to report validation issues
   * @returns The inferred type or undefined if type cannot be determined
   */
  static inferType(expr: any, accept: ValidationAcceptor): string | undefined {
    if (!expr) return undefined;

    // 1) Binary expression (e.g., 1 + 2, x > y)
    if (expr.$type === "BinExpr") {
      const left = TypeInferenceUtils.inferType(expr.e1, accept);
      const right = TypeInferenceUtils.inferType(expr.e2, accept);
      return TypeInferenceUtils.inferBinaryExpressionType(
        expr,
        left,
        right,
        expr.op,
        accept
      );
    }

    // 2) Unary expressions (negation, not, parenthesized)
    if (
      expr.$type === "NegExpr" ||
      expr.$type === "NotExpr" ||
      expr.$type === "ParenExpr"
    ) {
      return TypeInferenceUtils.inferUnaryExpressionType(
        TypeInferenceUtils.inferType(expr.expr, accept)
      );
    }

    // 3) Reference expressions (variable, enum, etc.)
    if (expr.$type === "Ref") {
      return TypeInferenceUtils.inferReferenceType(expr, accept);
    }

    // 4) Case literal with enum member
    if (expr.$type === "CaseLiteral") {
      return TypeInferenceUtils.inferCaseLiteralType(expr, accept);
    }

    // 5) Array literal
    if (isArrayLiteral(expr.val)) {
      return TypeInferenceUtils.inferArrayLiteralType(expr, expr.val, accept);
    }

    // 6) Struct literal
    if (isStructLiteral(expr.val)) {
      return "STRUCT";
    }

    // 7) Primitive literals (numbers, strings, booleans)
    return TypeInferenceUtils.inferPrimitiveLiteralType(expr);
  }

  /**
   * Determines if a source type can be assigned to a target type
   *
   * @param sourceType The type being assigned
   * @param targetType The type being assigned to
   * @returns Whether the assignment is valid
   */
  static isTypeAssignable(sourceType: string, targetType: string): boolean {
    if (sourceType === targetType) return true;

    if (sourceType.startsWith("ARRAY<") && targetType.startsWith("ARRAY<")) {
      // Extract base type and size
      const sourceMatch = /^ARRAY<(.+?)>\[(.+)\]$/.exec(sourceType);
      const targetMatch = /^ARRAY<(.+?)>\[(.+)\]$/.exec(targetType);
      if (!sourceMatch || !targetMatch) return false;

      const sourceElement = sourceMatch[1];
      const sourceSize = sourceMatch[2];
      const targetElement = targetMatch[1];
      const targetSize = targetMatch[2];

      // Allow INT to REAL conversion in arrays
      const elementTypesCompatible =
        sourceElement === targetElement ||
        (sourceElement === "INT" && targetElement === "REAL");

      // Compare both element types and sizes
      return elementTypesCompatible && sourceSize === targetSize;
    }

    if (sourceType === "INT" && targetType === "REAL") {
      return true;
    }

    if (sourceType.startsWith("ENUM:") && targetType === sourceType) {
      return true;
    }

    return false;
  }

  /**
   * Infers the type of a variable declaration by examining its type reference
   *
   * @param varDecl The variable declaration
   * @returns The inferred type or undefined
   */
  static inferVarDeclType(varDecl: VarDecl | undefined): string | undefined {
    if (!varDecl) return undefined;
    if (!varDecl.typeRef) return undefined;

    let baseType: string | undefined;

    // Built-in primitive types
    if (varDecl.typeRef.type) {
      baseType = varDecl.typeRef.type;
    }

    // Referencing user-defined types
    if (varDecl.typeRef.ref) {
      const typeDecl = varDecl.typeRef.ref.ref;
      if (!typeDecl) return undefined;
      if (isEnumDecl(typeDecl)) {
        baseType = `ENUM:${typeDecl.name}`;
      }
      if (isFunctionBlockDecl(typeDecl)) {
        baseType = `FB:${typeDecl.name}`;
      }
      if (isStructDecl(typeDecl)) {
        baseType = `STRUCT:${typeDecl.name}`;
      }
      if (isTypeAlias(typeDecl)) {
        baseType = typeDecl.primitive;
      }
    }

    if (!baseType) return undefined;
    if (varDecl.typeRef.sizes.length > 0) {
      const sizes = varDecl.typeRef.sizes
        .map((s) =>
          s.$type === "Primary" && typeof s.val === "number" ? s.val : "?"
        )
        .join("][");
      return `ARRAY<${baseType}>[${sizes}]`;
    }

    return baseType;
  }

  /**
   * Infers the type of a reference expression (variable, field access, array indexing)
   */
  private static inferReferenceType(
    expr: any,
    accept: ValidationAcceptor
  ): string | undefined {
    const ref = expr.ref?.ref;
    if (!ref) return undefined;

    const type = TypeInferenceUtils.inferBasicReferenceType(ref, expr, accept);

    // Note: Array indices validation is handled separately at the validation layer
    // via ArrayValidationUtils to avoid circular dependencies

    return type;
  }

  /**
   * Infers the basic type of a reference before processing properties/indexing
   */
  private static inferBasicReferenceType(
    ref: any,
    expr: any,
    accept: ValidationAcceptor
  ): string | undefined {
    // Variable reference
    if (isVarDecl(ref)) {
      return TypeInferenceUtils.processVariableReference(ref, expr, accept);
    }
    // Datapoint reference
    else if (ref.$type === "Datapoint") {
      return TypeInferenceUtils.inferDatapointChannelType(ref, expr);
    }
    // Enum declaration reference
    else if (isEnumDecl(ref)) {
      return TypeInferenceUtils.inferEnumDeclType(ref);
    }

    return undefined;
  }

  /**
   * Processes variable reference with array indexing and struct properties
   */
  private static processVariableReference(
    ref: any,
    expr: any,
    accept: ValidationAcceptor
  ): string | undefined {
    let type = TypeInferenceUtils.inferVarDeclType(ref);

    // First: Apply array indexing if needed
    if (expr.indices.length > 0 && type) {
      type = TypeInferenceUtils.applyArrayIndexing(expr, type, accept);
      if (!type) return undefined;
    }

    // Then: Process struct properties
    for (const prop of expr.properties) {
      type = TypeInferenceUtils.inferStructPropertyType(
        expr,
        type!,
        prop,
        accept
      );
      if (!type) return undefined;
    }

    return type;
  }

  /**
   * Private helper methods for type inference
   */

  private static inferBinaryExpressionType(
    expr: any,
    left: string | undefined,
    right: string | undefined,
    op: string,
    accept: ValidationAcceptor
  ): string | undefined {
    if (!left || !right) {
      accept("error", `Cannot infer operand types for binary expression.`, {
        node: expr,
      });
      return undefined;
    }

    // Comparison operators
    if (["==", "!=", "<", "<=", ">", ">="].includes(op)) {
      if (TypeInferenceUtils.areTypesComparable(left, right)) {
        return "BOOL";
      } else {
        accept(
          "error",
          `Cannot compare values of types '${left}' and '${right}' with '${op}'.`,
          { node: expr }
        );
        return undefined;
      }
    }

    // Logical operators
    if (["&&", "||"].includes(op)) {
      if (left === "BOOL" && right === "BOOL") {
        return "BOOL";
      } else {
        accept(
          "error",
          `Logical operator '${op}' requires both operands to be BOOL, but got '${left}' and '${right}'.`,
          { node: expr }
        );
        return undefined;
      }
    }

    // Arithmetic operators
    if (["+", "-", "*", "/", "%"].includes(op)) {
      return TypeInferenceUtils.inferArithmeticType(
        left,
        right,
        op,
        accept,
        expr
      );
    }

    accept("error", `Unknown binary operator '${op}'.`, { node: expr });
    return undefined;
  }

  private static inferUnaryExpressionType(
    innerType: string | undefined
  ): string | undefined {
    return innerType;
  }

  private static inferArrayLiteralType(
    expr: any,
    arrayLiteral: any,
    accept: ValidationAcceptor
  ): string | undefined {
    const elements = arrayLiteral.elements;
    if (elements.length === 0) {
      return "ARRAY<unknown>[0]";
    }

    // Infer element types
    let firstElementType = TypeInferenceUtils.inferType(elements[0], accept);

    // If first element is STRUCT but surrounded by a known typeRef, use that
    if (firstElementType === "STRUCT") {
      const parentVarDecl = AstUtils.getContainerOfType(expr, isVarDecl);
      const structDecl = parentVarDecl?.typeRef?.ref?.ref;
      if (isStructDecl(structDecl)) {
        firstElementType = `STRUCT:${structDecl.name}`;
      }
    }

    if (!firstElementType) {
      return `ARRAY<unknown>[${elements.length}]`;
    }

    if (firstElementType.startsWith("ARRAY<")) {
      // Nested array inside - validate ALL sub-arrays have consistent types
      const innerMatch = /^ARRAY<(.+)>(\[(.+?)\])+$/.exec(firstElementType);
      if (innerMatch) {
        const baseType = innerMatch[1];
        const innerDims = innerMatch[2]; // [5] or [5][5], etc

        // Validate all elements are arrays with the same base type
        for (let i = 1; i < elements.length; i++) {
          const elementType = TypeInferenceUtils.inferType(elements[i], accept);
          if (!elementType?.startsWith("ARRAY<")) {
            return `ARRAY<mixed>[${elements.length}]`;
          }

          const elementMatch = /^ARRAY<(.+)>(\[(.+?)\])+$/.exec(elementType);
          if (!elementMatch || elementMatch[1] !== baseType) {
            return `ARRAY<mixed>[${elements.length}]`;
          }
        }

        return `ARRAY<${baseType}>[${elements.length}]${innerDims}`;
      }
    }

    // Simple flat array
    const elementTypes = new Set(
      elements.map((e: any) => {
        let elementType = TypeInferenceUtils.inferType(e, accept);

        // Apply struct context resolution to all struct elements
        if (elementType === "STRUCT") {
          const parentVarDecl = AstUtils.getContainerOfType(expr, isVarDecl);
          const structDecl = parentVarDecl?.typeRef?.ref?.ref;
          if (isStructDecl(structDecl)) {
            elementType = `STRUCT:${structDecl.name}`;
          }
        }

        return elementType;
      })
    );

    if (elementTypes.size > 1) {
      return `ARRAY<mixed>[${elements.length}]`;
    } else {
      const singleType = [...elementTypes][0];
      return `ARRAY<${singleType}>[${elements.length}]`;
    }
  }

  private static inferPrimitiveLiteralType(expr: any): string | undefined {
    if (typeof expr.val === "number") {
      const raw = expr.$cstNode?.text;
      return raw?.includes(".") ? "REAL" : "INT";
    }

    if (typeof expr.val === "boolean" && expr.$cstNode?.text !== "now") {
      return "BOOL";
    }

    if (typeof expr.val === "string") {
      if (expr.val.startsWith("TOD#")) {
        return "TOD";
      } else if (expr.val.startsWith("T#")) {
        return "TIME";
      } else {
        return "STRING";
      }
    }

    if (isPrimary(expr) && expr.$cstNode?.text === "now") {
      return "TOD";
    }

    return undefined;
  }

  private static inferStructPropertyType(
    expr: any,
    baseType: string,
    prop: any,
    accept: ValidationAcceptor
  ): string | undefined {
    if (!baseType?.startsWith("STRUCT:")) {
      accept(
        "error",
        `Cannot access property '${prop.ref?.name}' on non-struct type '${baseType}'.`,
        { node: expr }
      );
      return undefined;
    }

    const controlModel = AstUtils.getContainerOfType(expr, isControlModel);
    const structName = baseType.substring("STRUCT:".length);
    const structDecl: StructDecl | undefined =
      (controlModel?.controlBlock?.items.find(
        (d: any) => isStructDecl(d) && d.name === structName
      ) as StructDecl | undefined) ??
      (controlModel?.externTypeDecls?.find(
        (d: any) => isStructDecl(d) && d.name === structName
      ) as StructDecl | undefined);

    if (!structDecl) {
      accept(
        "error",
        `Cannot access property '${prop.ref?.name}' on unknown struct type '${structName}'.`,
        { node: expr }
      );
      return undefined;
    }

    const field = structDecl.fields.find((f: any) => f.name === prop.ref?.name);
    if (!field) {
      accept(
        "error",
        `Unknown field '${prop.ref?.name}' in struct '${structName}'.`,
        { node: expr }
      );
      return undefined;
    }

    // Determine the field type
    if (field.typeRef?.type) {
      return field.typeRef.type;
    } else if (field.typeRef?.ref?.ref) {
      const refTypeDecl = field.typeRef.ref.ref;
      if (isStructDecl(refTypeDecl)) {
        return `STRUCT:${refTypeDecl.name}`;
      } else if (isEnumDecl(refTypeDecl)) {
        return `ENUM:${refTypeDecl.name}`;
      } else if (isTypeAlias(refTypeDecl)) {
        return refTypeDecl.primitive;
      }
    }

    return undefined;
  }

  private static inferDatapointChannelType(
    ref: any,
    expr: any
  ): string | undefined {
    if (expr.properties.length === 1) {
      const channel = expr.properties[0]?.ref;
      if (isChannel(channel)) {
        return channel.dataType; // Fixed property name
      }
    }
    return undefined;
  }

  private static inferEnumDeclType(ref: any): string | undefined {
    return `ENUM:${ref.name}`;
  }

  private static inferCaseLiteralType(
    expr: any,
    accept: ValidationAcceptor
  ): string | undefined {
    if (isEnumMemberLiteral(expr.val)) {
      return `ENUM:${expr.val.enumDecl.$refText}`;
    }

    // Handle primitive literals used as case values
    if (isPrimary(expr) || (expr.val && typeof expr.val !== "object")) {
      return TypeInferenceUtils.inferPrimitiveLiteralType(expr);
    }

    return undefined;
  }

  private static applyArrayIndexing(
    expr: any,
    type: string,
    accept: ValidationAcceptor
  ): string | undefined {
    let arrayMatch = /^ARRAY<(.+)>(\[(?:\d+|\?)+\])+$/u.exec(type);

    if (arrayMatch) {
      let baseType = arrayMatch[1];
      let dims = (type.match(/\[\d+|\?\]/g) || []).map((d) =>
        d.replace(/[[\]]/g, "")
      );

      for (const _ of expr.indices) {
        if (dims.length > 0) {
          dims.shift(); // remove one dimension
        } else {
          accept("error", `Too many indices for type '${type}'.`, {
            node: expr,
          });
          return undefined;
        }
      }

      if (dims.length > 0) {
        // Still an array
        type = `ARRAY<${baseType}>` + dims.map((d) => `[${d}]`).join("");
      } else {
        // Base element
        type = baseType;
      }
    } else if (expr.indices.length > 0) {
      accept("error", `Cannot index into non-array type '${type}'.`, {
        node: expr,
      });
      return undefined;
    }

    return type;
  }

  private static areTypesComparable(left: string, right: string): boolean {
    const comparableGroups: string[][] = [
      ["INT", "REAL"],
      ["STRING"],
      ["BOOL"],
      ["TOD"],
      ["TIME"],
    ];

    for (const group of comparableGroups) {
      if (group.includes(left) && group.includes(right)) {
        return true;
      }
    }

    if (
      left.startsWith("ENUM:") &&
      right.startsWith("ENUM:") &&
      left === right
    ) {
      return true;
    }

    return false;
  }

  private static inferArithmeticType(
    left: string,
    right: string,
    op: string,
    accept: ValidationAcceptor,
    expr: any
  ): string | undefined {
    const numericTypes = ["INT", "REAL"];

    if (!numericTypes.includes(left) || !numericTypes.includes(right)) {
      accept(
        "error",
        `Arithmetic operator '${op}' requires numeric operands, but got '${left}' and '${right}'.`,
        { node: expr }
      );
      return undefined;
    }

    // If either operand is REAL, result is REAL
    if (left === "REAL" || right === "REAL") {
      return "REAL";
    }

    return "INT";
  }
}
