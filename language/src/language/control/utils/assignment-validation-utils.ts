import { ValidationAcceptor } from "langium";
import { VarDecl, AssignmentStmt } from "../../generated/ast.js";
import { StructValidationUtils } from "./struct-validation-utils.js";
import { ArrayValidationUtils } from "./array-validation-utils.js";
import { TypeInferenceUtils } from "./type-inference-utils.js";

/**
 * Utility class for validating variable declarations and assignments in the BCS control language.
 * Contains methods for type checking, compatibility validation, and error reporting.
 */
export class AssignmentValidationUtils {
  /**
   * Validates the type of a variable declaration by checking if the declared type
   * and the initialization type (if present) are compatible.
   */
  static validateVarDeclTypes(
    varDecl: VarDecl,
    accept: ValidationAcceptor
  ): void {
    // 1. Infer and validate the declared type
    const type = TypeInferenceUtils.inferVarDeclType(varDecl);
    if (!type) {
      this.reportNoTypeError(varDecl, accept);
      return;
    }

    // 2. Skip further checks if there's no initializer
    if (!varDecl.init) {
      return;
    }

    // 3. Check the initialization type and compatibility
    this.checkInitializerTypeCompatibility(varDecl, type, accept);

    // 4. Check array size if applicable
    ArrayValidationUtils.checkArraySizeConsistency(varDecl, accept);
  }

  /**
   * Validates assignment statement types
   */
  static validateAssignmentTypes(
    stmt: AssignmentStmt,
    accept: ValidationAcceptor,
    stringifyExpression: (expr: any) => string
  ): void {
    const leftType = TypeInferenceUtils.inferType(stmt.target, accept);
    const rightType = TypeInferenceUtils.inferType(stmt.value, accept);

    ArrayValidationUtils.checkArrayIndexTypes(
      stmt.target,
      accept,
      TypeInferenceUtils.inferType
    );
    ArrayValidationUtils.checkArrayIndexTypes(
      stmt.value,
      accept,
      TypeInferenceUtils.inferType
    );

    if (!leftType || !rightType) {
      accept(
        "warning",
        `Cannot infer type for assignment: ${
          stmt.target.ref.ref?.name
        } = ${stringifyExpression(stmt.value)}`,
        { node: stmt }
      );
      return;
    }

    if (leftType.startsWith("STRUCT:") && rightType === "STRUCT") {
      StructValidationUtils.validateStructLiteralAssignment(stmt, accept);
      return;
    }

    if (!TypeInferenceUtils.isTypeAssignable(rightType, leftType)) {
      accept(
        "error",
        `Type mismatch: Cannot assign "${rightType}" to "${leftType}".`,
        { node: stmt, property: "value" }
      );
    }
  }

  /**
   * Reports an error when the variable declaration type cannot be inferred
   */
  static reportNoTypeError(varDecl: VarDecl, accept: ValidationAcceptor): void {
    accept(
      "error",
      `Cannot infer type for variable declaration: ${varDecl.name}`,
      { node: varDecl, property: "typeRef" }
    );
  }

  /**
   * Checks that the initializer's type is compatible with the variable's declared type
   */
  static checkInitializerTypeCompatibility(
    varDecl: VarDecl,
    declaredType: string,
    accept: ValidationAcceptor
  ): void {
    const initType = TypeInferenceUtils.inferType(varDecl.init, accept);
    if (!initType) {
      this.reportNoInitTypeError(varDecl, accept);
      return;
    }

    // Handle struct literals which require special validation
    if (declaredType.startsWith("STRUCT:") && initType === "STRUCT") {
      StructValidationUtils.validateStructLiteralAssignment(varDecl, accept);
      return;
    }

    // Handle struct array literals which require element-wise validation
    if (StructValidationUtils.isStructArrayAssignment(declaredType, initType)) {
      StructValidationUtils.validateStructArrayAssignment(
        varDecl,
        declaredType,
        accept
      );
      return;
    }

    // Regular type compatibility check
    if (!TypeInferenceUtils.isTypeAssignable(initType, declaredType)) {
      this.reportTypeMismatchError(varDecl, initType, declaredType, accept);
    }
  }

  /**
   * Reports an error when the initializer type cannot be inferred
   */
  static reportNoInitTypeError(
    varDecl: VarDecl,
    accept: ValidationAcceptor
  ): void {
    const stringifyExpression = (expr: any): string => {
      // Simple stringify for error messages
      return expr?.$cstNode?.text ?? "unknown expression";
    };

    accept(
      "error",
      `Cannot infer type for variable initialization: ${
        varDecl.name
      } = ${stringifyExpression(varDecl.init)}`,
      { node: varDecl, property: "init" }
    );
  }

  /**
   * Reports a type mismatch error between initializer and variable declaration
   */
  static reportTypeMismatchError(
    varDecl: VarDecl,
    initType: string,
    declaredType: string,
    accept: ValidationAcceptor
  ): void {
    accept(
      "error",
      `Type mismatch: Cannot assign "${initType}" to "${declaredType}".`,
      { node: varDecl, property: "init" }
    );
  }
}
