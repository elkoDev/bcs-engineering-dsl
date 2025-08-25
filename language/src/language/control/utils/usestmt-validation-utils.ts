import { ValidationAcceptor } from "langium";
import {
  UseStmt,
  FunctionBlockDecl,
  UseOutput,
  isDatapoint,
  isEnumDecl,
  Ref,
} from "../../generated/ast.js";
import { getInputs, getOutputs } from "./function-block-utils.js";
import { DuplicationValidationUtils } from "./duplication-validation-utils.js";
import { TypeInferenceUtils } from "./type-inference-utils.js";
import { ExpressionUtils } from "./expression-utils.js";

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
    accept: ValidationAcceptor
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
    this.validateInputTypes(useStmt, fb, accept);

    // 3) Check: Duplicate input mappings
    DuplicationValidationUtils.checkDuplicateInputMappings(useStmt, fb, accept);
  }

  /**
   * Validates input types for a UseStmt
   */
  static validateInputTypes(
    useStmt: UseStmt,
    fb: FunctionBlockDecl,
    accept: ValidationAcceptor
  ): void {
    for (const arg of useStmt.inputArgs) {
      const inputVarName = arg.inputVar.ref?.name;
      if (!inputVarName) continue;

      const paramDecl = getInputs(fb).find((i) => i.name === inputVarName);
      const expectedType = TypeInferenceUtils.inferVarDeclType(paramDecl);
      const actualType = TypeInferenceUtils.inferType(arg.value, accept);

      if (
        expectedType &&
        actualType &&
        !TypeInferenceUtils.isTypeAssignable(actualType, expectedType)
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
    const actualTarget = output.singleOutput!.target;

    if (UseStmtValidationUtils.checkTargetIsAssignable(actualTarget, accept)) {
      const expectedType = TypeInferenceUtils.inferVarDeclType(expected);
      const actualType = TypeInferenceUtils.inferType(actualTarget, accept);

      if (
        expectedType &&
        actualType &&
        !TypeInferenceUtils.isTypeAssignable(expectedType, actualType)
      ) {
        accept(
          "error",
          `Type mismatch for output '${
            expected.name
          }': cannot assign to '${ExpressionUtils.stringifyExpression(
            actualTarget
          )}' of type '${actualType}', expected '${expectedType}'.`,
          { node: output.singleOutput!, property: "target" }
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
    DuplicationValidationUtils.checkDuplicateOutputMappings(
      useStmt,
      fb,
      output,
      accept
    );

    // Perform type checking for mappings
    for (const map of output.mappingOutputs) {
      const fbOutputVar = map.fbOutputVar?.ref;
      const targetRef = map.target;

      if (!targetRef || !fbOutputVar) continue;

      if (UseStmtValidationUtils.checkTargetIsAssignable(targetRef, accept)) {
        const expected = getOutputs(fb).find(
          (o) => o.name === fbOutputVar.name
        );
        const expectedType = expected
          ? TypeInferenceUtils.inferVarDeclType(expected)
          : undefined;
        const actualType = TypeInferenceUtils.inferType(targetRef, accept);

        if (
          expectedType &&
          actualType &&
          !TypeInferenceUtils.isTypeAssignable(expectedType, actualType)
        ) {
          accept(
            "error",
            `Type mismatch: cannot assign output '${
              fbOutputVar.name
            }' to '${ExpressionUtils.stringifyExpression(
              targetRef
            )}'. Expected assignable type for '${expectedType}', but got '${actualType}'.`,
            { node: map, property: "target" }
          );
        }
      }
    }
  }

  private static checkTargetIsAssignable(
    target: Ref,
    accept: ValidationAcceptor
  ): boolean {
    const targetRef = target.ref?.ref;
    if (!targetRef) return true; // Let other validators handle unresolved refs

    if (isEnumDecl(targetRef)) {
      accept("error", "Cannot assign a 'use' output to an enum type.", {
        node: target,
      });
      return false;
    }

    if (isDatapoint(targetRef)) {
      const portGroup = targetRef.portgroup?.ref;
      if (portGroup?.ioType.includes("INPUT")) {
        accept(
          "error",
          `Cannot assign a 'use' output to a read-only input channel.`,
          { node: target }
        );
        return false;
      }
    }
    return true;
  }
}
