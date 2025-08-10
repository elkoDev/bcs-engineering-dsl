import { ValidationAcceptor } from "langium";
import {
  UseStmt,
  FunctionBlockDecl,
  UseOutput,
} from "../../generated/ast.js";
import { getInputs, getOutputs } from "./function-block-utils.js";
import { DuplicationValidator } from "./duplication-validation-utils.js";
import { inferVarDeclType, isTypeAssignable } from "./type-inference-utils.js";

/**
 * Utility class for validating UseStmt (function block usage) operations.
 * Contains methods for validating inputs, outputs, and type compatibility.
 */
export class UseStmtValidationUtils {
  /**
   * Validates function block inputs for a UseStmt
   */
  static validateFunctionBlockInputs(
    useStmt: UseStmt,
    fb: FunctionBlockDecl,
    accept: ValidationAcceptor,
    inferType: (expr: any, accept: ValidationAcceptor) => string | undefined
  ): void {
    // 1) Check: Number of input arguments vs number of inputs
    if (useStmt.inputArgs.length !== getInputs(fb).length) {
      accept(
        "error",
        `Function block '${fb.name}' expects ${
          getInputs(fb).length
        } input arguments, but got ${useStmt.inputArgs.length}.`,
        { node: useStmt, property: "inputArgs" }
      );
    }

    // 2) Check: Input types
    this.validateInputTypes(useStmt, fb, accept, inferType);

    // 3) Check: Duplicate input mappings
    DuplicationValidator.checkDuplicateInputMappings(useStmt, fb, accept);
  }

  /**
   * Validates input types for a UseStmt
   */
  static validateInputTypes(
    useStmt: UseStmt,
    fb: FunctionBlockDecl,
    accept: ValidationAcceptor,
    inferType: (expr: any, accept: ValidationAcceptor) => string | undefined
  ): void {
    for (const arg of useStmt.inputArgs) {
      const inputVarName = arg.inputVar.ref?.name;
      if (!inputVarName) continue;

      const paramDecl = getInputs(fb).find((i) => i.name === inputVarName);
      const expectedType = inferVarDeclType(paramDecl);
      const actualType = inferType(arg.value, accept);

      if (
        expectedType &&
        actualType &&
        !isTypeAssignable(actualType, expectedType)
      ) {
        accept(
          "error",
          `Type mismatch for input '${inputVarName}': expected '${expectedType}', got '${actualType}'.`,
          { node: arg.value }
        );
      }
    }
  }

  /**
   * Validates function block outputs for a UseStmt
   */
  static validateFunctionBlockOutputs(
    useStmt: UseStmt,
    fb: FunctionBlockDecl,
    output: UseOutput,
    accept: ValidationAcceptor
  ): void {
    if (!output) return;

    // Determine if output is single or mapping
    const isSingle = !!output.singleOutput;
    const isMapping =
      !!output.mappingOutputs && output.mappingOutputs.length > 0;

    if (isSingle && isMapping) {
      accept("error", "Cannot mix single and mapped outputs.", {
        node: useStmt,
        property: "useOutput",
      });
      return;
    }

    // Single output result (direct reference)
    if (isSingle) {
      this.validateSingleOutput(useStmt, fb, output, accept);
    }
    // Output mapping list (explicit mappings)
    else if (isMapping) {
      this.validateMappedOutputs(useStmt, fb, output, accept);
    }
    // No outputs provided
    else if (getOutputs(fb).length > 0) {
      accept(
        "error",
        `Function block '${fb.name}' expects ${
          getOutputs(fb).length
        } outputs, but got 0.`,
        { node: useStmt, property: "useOutput" }
      );
    }
  }

  /**
   * Validates single output assignment for a UseStmt
   */
  static validateSingleOutput(
    useStmt: UseStmt,
    fb: FunctionBlockDecl,
    output: UseOutput,
    accept: ValidationAcceptor
  ): void {
    if (getOutputs(fb).length !== 1) {
      accept(
        "error",
        `Function block '${fb.name}' has ${
          getOutputs(fb).length
        } outputs, cannot use direct assignment. Use mapping instead.`,
        { node: useStmt, property: "useOutput" }
      );
      return;
    }

    const expected = getOutputs(fb)[0];
    const actual = output.singleOutput!.targetOutputVar?.ref;

    if (actual) {
      const expectedType = inferVarDeclType(expected);
      const actualType = inferVarDeclType(actual);

      if (
        expectedType &&
        actualType &&
        !isTypeAssignable(expectedType, actualType)
      ) {
        accept(
          "error",
          `Type mismatch for output '${expected.name}': cannot assign to '${actual.name}' of type '${actualType}', expected '${expectedType}'.`,
          { node: output.singleOutput!, property: "targetOutputVar" }
        );
      }
    }
  }

  /**
   * Validates mapped outputs for a UseStmt
   */
  static validateMappedOutputs(
    useStmt: UseStmt,
    fb: FunctionBlockDecl,
    output: UseOutput,
    accept: ValidationAcceptor
  ): void {
    if (output.mappingOutputs.length !== getOutputs(fb).length) {
      accept(
        "error",
        `Function block '${fb.name}' expects ${
          getOutputs(fb).length
        } outputs, but got ${output.mappingOutputs.length}.`,
        { node: useStmt, property: "useOutput" }
      );
    }

    // Check for duplicates and type compatibility
    DuplicationValidator.checkDuplicateOutputMappings(
      useStmt,
      fb,
      output,
      accept
    );

    // Perform type checking for mappings
    for (const map of output.mappingOutputs) {
      const fbOutputVar = map.fbOutputVar?.ref;
      const targetOutputVar = map.targetOutputVar?.ref;

      if (!targetOutputVar || !fbOutputVar) continue;

      const expected = getOutputs(fb).find((o) => o.name === fbOutputVar.name);
      const expectedType = expected ? inferVarDeclType(expected) : undefined;
      const actualType = inferVarDeclType(targetOutputVar);

      if (
        expectedType &&
        actualType &&
        !isTypeAssignable(expectedType, actualType)
      ) {
        accept(
          "error",
          `Type mismatch for mapped output '${fbOutputVar.name}': expected '${expectedType}', got '${actualType}'.`,
          { node: map, property: "fbOutputVar" }
        );
      }
    }
  }
}
