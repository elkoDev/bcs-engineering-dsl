import { ValidationAcceptor } from "langium";
import {
  ArrayLiteral,
  Primary,
  VarDecl,
  isPrimary,
  isArrayLiteral,
} from "../../generated/ast.js";
import { validateArrayIndex } from "./type-inference-utils.js";

/**
 * Utility class for validating array-related operations in the BCS control language.
 * Contains methods for validating array indices, bounds, sizes, and types.
 */
export class ArrayValidationUtils {
  /**
   * Validates the indices of an array reference expression
   */
  static validateArrayIndices(
    ref: any,
    expr: any,
    accept: ValidationAcceptor,
    inferType: (expr: any, accept: ValidationAcceptor) => string | undefined
  ): void {
    const sizes = ref.typeRef?.sizes ?? [];

    for (let i = 0; i < expr.indices.length && i < sizes.length; i++) {
      const indexExpr = expr.indices[i];
      const sizeExpr = sizes[i];

      // Validate index type
      const idxType = inferType(indexExpr, accept);
      if (idxType !== "INT") {
        accept(
          "error",
          `Array index must be of type INT, but got "${idxType}".`,
          { node: indexExpr }
        );
      }

      // Validate index bounds when possible
      validateArrayIndex(expr, indexExpr, sizeExpr, accept);
    }
  }

  /**
   * Checks array index types for expressions
   */
  static checkArrayIndexTypes(
    expr: any,
    accept: ValidationAcceptor,
    inferType: (expr: any, accept: ValidationAcceptor) => string | undefined
  ): void {
    if (expr.$type === "Ref" && expr.indices.length > 0) {
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
  }

  /**
   * Checks that array initializer sizes match the declared dimensions
   */
  static checkArraySizeConsistency(
    varDecl: VarDecl,
    accept: ValidationAcceptor
  ): void {
    if (
      !this.hasArrayTypeWithSizes(varDecl) ||
      !this.hasArrayLiteralInit(varDecl)
    ) {
      return;
    }

    const expectedDimensions = this.extractArrayDimensions(
      varDecl.typeRef.sizes
    );
    if (expectedDimensions.length === 0) {
      return;
    }

    this.validateArrayLiteralSize(
      (varDecl.init! as Primary).val as ArrayLiteral,
      expectedDimensions,
      accept,
      varDecl
    );
  }

  /**
   * Checks if the variable declaration has an array type with specified sizes
   */
  static hasArrayTypeWithSizes(varDecl: VarDecl): boolean {
    return !!varDecl.typeRef?.sizes.length;
  }

  /**
   * Checks if the variable has an array literal as initializer
   */
  static hasArrayLiteralInit(varDecl: VarDecl): boolean {
    return isPrimary(varDecl.init) && isArrayLiteral(varDecl.init.val);
  }

  /**
   * Extracts array dimensions from size expressions
   */
  static extractArrayDimensions(sizeExprs: any[]): number[] {
    const dimensions: number[] = [];

    for (const sizeExpr of sizeExprs) {
      if (sizeExpr.$type === "Primary" && typeof sizeExpr.val === "number") {
        dimensions.push(sizeExpr.val);
      } else {
        console.log("Skipping size validation: complex size expression.");
        return [];
      }
    }

    return dimensions;
  }

  /**
   * Validates the size of an array literal against expected dimensions
   */
  static validateArrayLiteralSize(
    arrayLiteral: ArrayLiteral,
    expectedDimensions: number[],
    accept: ValidationAcceptor,
    node: any
  ): void {
    const expectedSize = expectedDimensions[0];

    if (arrayLiteral.elements.length !== expectedSize) {
      accept(
        "error",
        `Array size mismatch: expected ${expectedSize} elements, but got ${arrayLiteral.elements.length}.`,
        { node }
      );
    }

    if (expectedDimensions.length > 1) {
      // We expect nested arrays
      for (const element of arrayLiteral.elements) {
        if (isPrimary(element) && isArrayLiteral(element.val)) {
          this.validateArrayLiteralSize(
            element.val,
            expectedDimensions.slice(1),
            accept,
            node
          );
        } else {
          accept(
            "error",
            `Expected nested array with ${expectedDimensions.length} dimensions.`,
            { node }
          );
        }
      }
    }
  }
}
