import { ValidationAcceptor, ValidationChecks } from "langium";
import { BCSControlLangServices } from "./bcs-control-lang-module.js";
import { DuplicationValidationUtils } from "./utils/duplication-validation-utils.js";
import { ArrayValidationUtils } from "./utils/array-validation-utils.js";
import { UseStmtValidationUtils } from "./utils/usestmt-validation-utils.js";
import { AssignmentValidationUtils } from "./utils/assignment-validation-utils.js";
import { ExpressionUtils } from "./utils/expression-utils.js";
import {
  BCSEngineeringDSLAstType,
  FunctionBlockDecl,
  ForStmt,
  AssignmentStmt,
  isDatapoint,
  isChannel,
  SwitchStmt,
  CaseLiteral,
  ControlUnit,
  ControlModel,
  isFunctionBlockInputs,
  isFunctionBlockOutputs,
  isFunctionBlockLocals,
  isFunctionBlockLogic,
  UseStmt,
  VarDecl,
  Channel,
  OnRisingEdgeStmt,
  OnFallingEdgeStmt,
  isOnRisingEdgeStmt,
  Ref,
  isVarDecl,
} from "../generated/ast.js";
import { TypeInferenceUtils } from "./utils/type-inference-utils.js";

export function registerBCSControlValidationChecks(
  services: BCSControlLangServices
) {
  const registry = services.validation.ValidationRegistry;
  const validator = services.validation.BCSControlLangValidator;
  const checks: ValidationChecks<BCSEngineeringDSLAstType> = {
    FunctionBlockDecl: [
      validator.checkUniqueVarNamesInFunctionBlock,
      validator.checkSingleBlockSectionsInFunctionBlock,
      validator.checkRequiredLibraryReferenceForExternFBs,
    ],
    ControlUnit: [
      validator.checkScanCycleUnits,
      validator.checkWhenConditionType,
      validator.checkControlUnitVariableConflicts,
    ],
    ControlModel: [validator.checkUniqueGlobalDeclarations],
    AssignmentStmt: [
      validator.checkAssignmentTypes,
      validator.checkNoWriteToInputDatapoints,
    ],
    VarDecl: [validator.checkVarDeclTypes],
    UseStmt: [validator.checkUseStmtTypes],
    Ref: [validator.checkArrayIndexTypes],
    SwitchStmt: [validator.checkSwitchCaseTypes],
    ForStmt: [validator.checkToExprType],
    OnRisingEdgeStmt: [validator.checkEdgeSignalType],
    OnFallingEdgeStmt: [validator.checkEdgeSignalType],
  };
  registry.register(checks, validator);
}

export class BCSControlLangValidator {
  checkRequiredLibraryReferenceForExternFBs(
    fb: FunctionBlockDecl,
    accept: ValidationAcceptor
  ) {
    if (fb.isExtern && !fb.libRef) {
      accept(
        "error",
        `Extern function block '${fb.name}' must have a library reference.`,
        { node: fb, property: "libRef" }
      );
    }
  }
  checkToExprType(stmt: ForStmt, accept: ValidationAcceptor) {
    const toExpr = stmt.toExpr;
    if (!toExpr) return;

    const type = TypeInferenceUtils.inferType(toExpr, accept);
    if (type && type !== "INT") {
      accept(
        "error",
        `For loop 'to' expression must be of type INT, but got '${type}'.`,
        { node: toExpr }
      );
    }
  }

  checkNoWriteToInputDatapoints(
    stmt: AssignmentStmt,
    accept: ValidationAcceptor
  ) {
    const refExpr = stmt.target;
    const targetDatapoint = refExpr.ref?.ref;

    // Check if there is exactly one property (access to a channel)
    if (!isDatapoint(targetDatapoint) || refExpr.properties.length !== 1) {
      return;
    }

    const channel = refExpr.properties[0]?.ref;
    if (!isChannel(channel)) return;

    const portGroup = targetDatapoint.portgroup?.ref;
    if (!portGroup) return;

    const ioType = portGroup.ioType;
    const forbidden = ["ANALOG_INPUT", "DIGITAL_INPUT"];

    if (forbidden.includes(ioType)) {
      accept(
        "error",
        `Cannot assign to input datapoint '${targetDatapoint.name}.${
          (channel as Channel).name
        }' (portgroup type '${ioType}').`,
        { node: stmt.target }
      );
    }
  }

  checkSwitchCaseTypes(sw: SwitchStmt, accept: ValidationAcceptor) {
    const switchType = TypeInferenceUtils.inferType(sw.expr, accept);
    if (!switchType) return;

    const seen = new Set<string>();

    const keyOf = (lit: CaseLiteral): string =>
      typeof lit.val === "object" ? lit.$cstNode?.text ?? "" : String(lit.val);

    for (const c of sw.cases) {
      for (const lit of c.literals) {
        const litType = TypeInferenceUtils.inferType(lit, accept);
        const litKey = keyOf(lit);

        if (seen.has(litKey)) {
          accept("error", `Duplicate case literal '${litKey}'.`, { node: lit });
        } else {
          seen.add(litKey);
        }

        if (!litType) continue;
        const ok =
          // exact match
          litType === switchType ||
          // INT can stand in for REAL, etc.
          TypeInferenceUtils.isTypeAssignable(litType, switchType);

        if (!ok) {
          accept(
            "error",
            `Case literal '${litKey}' is of type '${litType}', but switch expression is '${switchType}'.`,
            { node: lit }
          );
        }
      }
    }
  }
  checkControlUnitVariableConflicts(
    unit: ControlUnit,
    accept: ValidationAcceptor
  ) {
    DuplicationValidationUtils.checkControlUnitVariableConflicts(unit, accept);
  }

  checkUniqueVarNamesInFunctionBlock(
    fb: FunctionBlockDecl,
    accept: ValidationAcceptor
  ) {
    DuplicationValidationUtils.checkUniqueVarNamesInFunctionBlock(fb, accept);
  }

  checkUniqueGlobalDeclarations(
    model: ControlModel,
    accept: ValidationAcceptor
  ) {
    DuplicationValidationUtils.checkUniqueGlobalDeclarations(model, accept);
  }

  checkWhenConditionType(unit: ControlUnit, accept: ValidationAcceptor) {
    if (unit.condition) {
      const type = TypeInferenceUtils.inferType(unit.condition, accept);
      if (type && type !== "BOOL") {
        accept(
          "error",
          `Condition in 'when (...)' of unit '${unit.name}' must be of type BOOL, but got '${type}'.`,
          { node: unit, property: "condition" }
        );
      }
    }
  }

  checkScanCycleUnits(unit: ControlUnit, accept: ValidationAcceptor) {
    if (!unit.condition && !unit.time && unit.stmts.length > 0) {
      accept(
        "hint",
        `Unit '${unit.name}' runs every scan cycle (no 'at' or 'when' clause).`,
        {
          node: unit,
          property: "name",
        }
      );
    }
  }

  checkSingleBlockSectionsInFunctionBlock(
    fb: FunctionBlockDecl,
    accept: ValidationAcceptor
  ) {
    let countInputs = 0;
    let countOutputs = 0;
    let countLocals = 0;
    let countLogic = 0;

    for (const member of fb.members) {
      if (isFunctionBlockInputs(member)) countInputs++;
      else if (isFunctionBlockOutputs(member)) countOutputs++;
      else if (isFunctionBlockLocals(member)) countLocals++;
      else if (isFunctionBlockLogic(member)) countLogic++;
    }

    if (countInputs > 1) {
      accept(
        "error",
        `Only one 'inputs' block allowed in function block '${fb.name}', found ${countInputs}.`,
        {
          node: fb,
        }
      );
    }
    if (countOutputs > 1) {
      accept(
        "error",
        `Only one 'outputs' block allowed in function block '${fb.name}', found ${countOutputs}.`,
        {
          node: fb,
        }
      );
    }
    if (countLocals > 1) {
      accept(
        "error",
        `Only one 'locals' block allowed in function block '${fb.name}', found ${countLocals}.`,
        {
          node: fb,
        }
      );
    }
    if (countLogic > 1) {
      accept(
        "error",
        `Only one 'logic' block allowed in function block '${fb.name}', found ${countLogic}.`,
        {
          node: fb,
        }
      );
    }
  }
  checkUseStmtTypes(useStmt: UseStmt, accept: ValidationAcceptor) {
    const fb = useStmt.functionBlockRef?.ref;
    if (!fb) return;

    UseStmtValidationUtils.validateFunctionBlockInputs(useStmt, fb, accept);
    UseStmtValidationUtils.validateFunctionBlockOutputs(
      useStmt,
      fb,
      useStmt.useOutput,
      accept
    );
  }

  /**
   * Validates the type of a variable declaration by checking if the declared type
   * and the initialization type (if present) are compatible. Reports errors using
   * the provided `ValidationAcceptor` if:
   * - The type of the variable declaration cannot be inferred.
   * - The type of the variable initialization cannot be inferred.
   * - The initialization type is not assignable to the declared type.
   *
   * @param varDecl - The variable declaration to validate.
   * @param accept - A function to report validation errors.
   */
  checkVarDeclTypes(varDecl: VarDecl, accept: ValidationAcceptor) {
    AssignmentValidationUtils.validateVarDeclTypes(varDecl, accept);
  }

  /**
   * Validates the types of an assignment statement by checking if the type of the
   * right-hand side expression is assignable to the type of the left-hand side target.
   *
   * @param stmt - The assignment statement to validate.
   * @param accept - A function to report validation issues, such as warnings or errors.
   *
   * @remarks
   * - If the type of either the target or the value cannot be inferred, a warning is reported.
   * - If the type of the value is not assignable to the type of the target, an error is reported.
   */
  checkAssignmentTypes(stmt: AssignmentStmt, accept: ValidationAcceptor) {
    AssignmentValidationUtils.validateAssignmentTypes(
      stmt,
      accept,
      ExpressionUtils.stringifyExpression
    );
  }

  checkArrayIndexTypes(expr: Ref, accept: ValidationAcceptor) {
    // Only validate if this is actually an array access (has indices)
    if (expr.indices && expr.indices.length > 0) {
      const namedElement = expr.ref?.ref;
      if (isVarDecl(namedElement) && namedElement.typeRef?.sizes?.length > 0) {
        // This is an array variable with indices - validate both type and bounds
        ArrayValidationUtils.validateArrayIndices(namedElement, expr, accept);
      } else {
        // Just validate index types (for the case where it's not a proper array)
        ArrayValidationUtils.checkArrayIndexTypes(expr, accept);
      }
    }
  }

  checkEdgeSignalType(
    stmt: OnRisingEdgeStmt | OnFallingEdgeStmt,
    accept: ValidationAcceptor
  ) {
    const signal = stmt.signal;
    if (!signal) return;

    const signalType = TypeInferenceUtils.inferType(signal, accept);
    if (signalType && signalType !== "BOOL") {
      const stmtType = isOnRisingEdgeStmt(stmt) ? "on_rising" : "on_falling";
      accept(
        "error",
        `Signal in '${stmtType}' must be of type BOOL, but got '${signalType}'.`,
        { node: signal }
      );
    }
  }
}
