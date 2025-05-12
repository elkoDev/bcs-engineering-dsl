import { AstUtils, ValidationAcceptor } from "langium";
import {
  ArrayLiteral,
  StructDecl,
  VarDecl,
  isChannel,
  isControlModel,
  isEnumDecl,
  isEnumMemberLiteral,
  isFunctionBlockDecl,
  isPrimary,
  isStructDecl,
  isTypeAlias,
  isVarDecl,
} from "../generated/ast.js";

/**
 * Infers the type of a binary expression by examining both operands and the operator.
 *
 * @param expr The binary expression to analyze
 * @param left The inferred type of the left operand
 * @param right The inferred type of the right operand
 * @param op The operator used in the binary expression
 * @param accept Function to report validation issues
 * @returns The inferred type or undefined if type cannot be determined
 */
export function inferBinaryExpressionType(
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
    if (areTypesComparable(left, right)) {
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
  if (op === "&&" || op === "||") {
    if (left === "BOOL" && right === "BOOL") {
      return "BOOL";
    } else {
      accept(
        "error",
        `Logical operator '${op}' can only be applied to BOOL operands, but got '${left}' and '${right}'.`,
        { node: expr }
      );
      return undefined;
    }
  }

  // Arithmetic operators
  if (["+", "-", "*", "/"].includes(op)) {
    if (
      (left === "INT" || left === "REAL") &&
      (right === "INT" || right === "REAL")
    ) {
      return left === "REAL" || right === "REAL" ? "REAL" : "INT";
    } else {
      accept(
        "error",
        `Operator '${op}' not applicable to types '${left}' and '${right}'.`,
        { node: expr }
      );
      return undefined;
    }
  }

  return undefined;
}

/**
 * Infers the type of unary expressions (negation, not, parenthesized)
 *
 * @param expr The expression to analyze
 * @param innerType The type of the inner expression
 * @returns The inferred type, typically the same as the inner expression
 */
export function inferUnaryExpressionType(
  innerType: string | undefined
): string | undefined {
  return innerType;
}

/**
 * Handles the property access on structs, validating each property exists
 * and returning the resulting type.
 *
 * @param expr The reference expression
 * @param baseType The starting type of the struct
 * @param prop The property being accessed
 * @param accept Function to report validation issues
 * @returns The type of the property or undefined if invalid
 */
export function inferStructPropertyType(
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
    (controlModel?.controlBlock.items.find(
      (d) => isStructDecl(d) && d.name === structName
    ) as StructDecl | undefined) ??
    (controlModel?.externTypeDecls.find(
      (d) => isStructDecl(d) && d.name === structName
    ) as StructDecl | undefined);

  if (!structDecl) {
    accept(
      "error",
      `Cannot access property '${prop.ref?.name}' on unknown struct type '${structName}'.`,
      { node: expr }
    );
    return undefined;
  }

  const field = structDecl.fields.find((f) => f.name === prop.ref?.name);
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

/**
 * Handles array indexing, checking array bounds and index types
 *
 * @param expr The array expression being indexed
 * @param type The type of the array
 * @param indexExpr The index expression
 * @param sizeExpr The size expression from the array definition
 * @param accept Function to report validation issues
 * @returns The type after applying array indexing
 */
export function validateArrayIndex(
  expr: any,
  indexExpr: any,
  sizeExpr: any,
  accept: ValidationAcceptor
): void {
  // Only check if both index and size are simple numbers
  if (
    isPrimary(indexExpr) &&
    typeof indexExpr.val === "number" &&
    isPrimary(sizeExpr) &&
    typeof sizeExpr.val === "number"
  ) {
    const indexVal = indexExpr.val;
    const maxVal = sizeExpr.val;

    if (indexVal < 0 || indexVal >= maxVal) {
      accept(
        "error",
        `Array index [${indexVal}] out of bounds: allowed range is 0 to ${
          maxVal - 1
        }.`,
        { node: expr }
      );
    }
  }
}

/**
 * Applies array indexing to an array type and returns the resulting type
 *
 * @param expr The expression containing array indices
 * @param type The array type
 * @param accept Function to report validation issues
 * @returns The resulting type after applying array indexing
 */
export function applyArrayIndexing(
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

/**
 * Infers the type of a primitive literal value
 *
 * @param expr The primary expression representing a literal
 * @returns The inferred type or undefined
 */
export function inferPrimitiveLiteralType(expr: any): string | undefined {
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

/**
 * Infers the type of an array literal by examining its elements
 *
 * @param expr The expression containing the array literal
 * @param arrayLiteral The array literal to analyze
 * @param accept Function to report validation issues
 * @returns The inferred array type
 */
export function inferArrayLiteralType(
  expr: any,
  arrayLiteral: ArrayLiteral,
  inferType: (expr: any, accept: ValidationAcceptor) => string | undefined,
  accept: ValidationAcceptor
): string | undefined {
  const elements = arrayLiteral.elements;
  if (elements.length === 0) {
    return "ARRAY<unknown>[0]";
  }

  // Infer element types
  let firstElementType = inferType(elements[0], accept);

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
    // Nested array inside
    const innerMatch = /^ARRAY<(.+)>(\[(.+?)\])+$/.exec(firstElementType);
    if (innerMatch) {
      const baseType = innerMatch[1];
      const innerDims = innerMatch[2]; // [5] or [5][5], etc
      return `ARRAY<${baseType}>[${elements.length}]${innerDims}`;
    }
  }

  // Simple flat array
  const elementTypes = new Set(elements.map((e) => inferType(e, accept)));

  if (elementTypes.size > 1) {
    return `ARRAY<mixed>[${elements.length}]`;
  } else {
    const singleType = [...elementTypes][0];
    return `ARRAY<${singleType}>[${elements.length}]`;
  }
}

/**
 * Determines if two types can be compared with comparison operators
 *
 * @param type1 First type
 * @param type2 Second type
 * @returns Whether the types are comparable
 */
export function areTypesComparable(type1: string, type2: string): boolean {
  const comparableGroups: string[][] = [
    ["INT", "REAL"],
    ["STRING"],
    ["BOOL"],
    ["TOD"],
    ["TIME"],
  ];

  for (const group of comparableGroups) {
    if (group.includes(type1) && group.includes(type2)) {
      return true;
    }
  }

  if (
    type1.startsWith("ENUM:") &&
    type2.startsWith("ENUM:") &&
    type1 === type2
  ) {
    return true;
  }

  return false;
}

/**
 * Determines if a source type can be assigned to a target type
 *
 * @param sourceType The type being assigned
 * @param targetType The type being assigned to
 * @returns Whether the assignment is valid
 */
export function isTypeAssignable(
  sourceType: string,
  targetType: string
): boolean {
  if (sourceType === targetType) return true;

  if (sourceType.startsWith("ARRAY<") && targetType.startsWith("ARRAY<")) {
    // Extract base type and size
    const sourceMatch = RegExp(/^ARRAY<(.+?)>\[(.+)\]$/).exec(sourceType);
    const targetMatch = RegExp(/^ARRAY<(.+?)>\[(.+)\]$/).exec(targetType);
    if (!sourceMatch || !targetMatch) return false;

    const sourceElement = sourceMatch[1];
    const sourceSize = sourceMatch[2];
    const targetElement = targetMatch[1];
    const targetSize = targetMatch[2];

    // Compare both element types and sizes
    return sourceElement === targetElement && sourceSize === targetSize;
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
export function inferVarDeclType(varDecl: VarDecl): string | undefined {
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
      .map((s: any) =>
        s.$type === "Primary" && typeof s.val === "number" ? s.val : "?"
      )
      .join("][");
    return `ARRAY<${baseType}>[${sizes}]`;
  }

  return baseType;
}

/**
 * Infers the type of a datapoint channel reference
 *
 * @param ref The datapoint reference
 * @param expr The expression containing properties
 * @returns The inferred type or undefined
 */
export function inferDatapointChannelType(
  ref: any,
  expr: any
): string | undefined {
  if (expr.properties.length === 1) {
    const channelRef = expr.properties[0]?.ref;
    if (isChannel(channelRef)) {
      return channelRef.dataType;
    }
  }
  return undefined;
}

/**
 * Infers the type of an enum declaration
 *
 * @param ref The enum declaration reference
 * @returns The inferred type
 */
export function inferEnumDeclType(ref: any): string {
  return `ENUM:${ref.name}`;
}

/**
 * Infers the type of an enum member literal
 *
 * @param expr The expression containing the enum member literal
 * @returns The inferred type or undefined
 */
export function inferEnumMemberLiteralType(expr: any): string | undefined {
  if (isEnumMemberLiteral(expr.val)) {
    return `ENUM:${expr.val.enumDecl.$refText}`;
  }
  return undefined;
}

/**
 * Infers the type of a case literal, which might be an enum member or a primitive value
 *
 * @param expr The case literal expression
 * @param accept Function to report validation issues
 * @returns The inferred type or undefined
 */
export function inferCaseLiteralType(
  expr: any,
  accept: ValidationAcceptor
): string | undefined {
  if (isEnumMemberLiteral(expr.val)) {
    return `ENUM:${expr.val.enumDecl.$refText}`;
  }

  // Handle primitive literals used as case values
  if (isPrimary(expr) || (expr.val && typeof expr.val !== "object")) {
    return inferPrimitiveLiteralType(expr);
  }

  return undefined;
}

/**
 * Validates array indices to ensure they use the correct type (INT)
 *
 * @param expr The reference expression with indices
 * @param accept Function to report validation issues
 * @param inferType Function to infer the type of expressions
 */
export function validateArrayIndices(
  expr: any,
  accept: ValidationAcceptor,
  inferType: (expr: any, accept: ValidationAcceptor) => string | undefined
): void {
  for (const idxExpr of expr.indices) {
    const idxType = inferType(idxExpr, accept);
    if (idxType !== "INT") {
      accept(
        "error",
        `Array index must be of type INT, but got "${idxType}".`,
        { node: idxExpr }
      );
    }
  }
}
