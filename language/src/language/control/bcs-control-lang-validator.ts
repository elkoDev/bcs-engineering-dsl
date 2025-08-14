import { ValidationAcceptor, ValidationChecks } from "langium";
import { BCSControlLangServices } from "./bcs-control-lang-module.js";
import {
  inferBinaryExpressionType,
  inferUnaryExpressionType,
  inferArrayLiteralType,
  inferPrimitiveLiteralType,
  inferVarDeclType,
  applyArrayIndexing,
  inferStructPropertyType,
  inferDatapointChannelType,
  inferEnumDeclType,
  inferCaseLiteralType,
  isTypeAssignable,
} from "./utils/type-inference-utils.js";
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
  isVarDecl,
  isArrayLiteral,
  isStructLiteral,
  isBinExpr,
  isCaseLiteral,
  isEnumDecl,
  Channel,
  OnRisingEdgeStmt,
  OnFallingEdgeStmt,
  isOnRisingEdgeStmt,
} from "../generated/ast.js";

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

    const type = this.inferType(toExpr, accept);
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
    const switchType = this.inferType(sw.expr, accept);
    if (!switchType) return;

    const seen = new Set<string>();

    const keyOf = (lit: CaseLiteral): string =>
      typeof lit.val === "object" ? lit.$cstNode?.text ?? "" : String(lit.val);

    for (const c of sw.cases) {
      for (const lit of c.literals) {
        const litType = this.inferType(lit, accept);
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
          isTypeAssignable(litType, switchType);

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
      const type = this.inferType(unit.condition, accept);
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

    UseStmtValidationUtils.validateFunctionBlockInputs(
      useStmt,
      fb,
      accept,
      this.inferType.bind(this)
    );
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
   */ checkVarDeclTypes(varDecl: VarDecl, accept: ValidationAcceptor) {
    AssignmentValidationUtils.validateVarDeclTypes(
      varDecl,
      accept,
      this.inferType.bind(this)
    );
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
   */ checkAssignmentTypes(stmt: AssignmentStmt, accept: ValidationAcceptor) {
    AssignmentValidationUtils.validateAssignmentTypes(
      stmt,
      accept,
      this.inferType.bind(this),
      ExpressionUtils.stringifyExpression
    );
  }

  checkArrayIndexTypes(expr: any, accept: ValidationAcceptor) {
    ArrayValidationUtils.checkArrayIndexTypes(
      expr,
      accept,
      this.inferType.bind(this)
    );
  }

  /**
   * Infers the type of an expression by delegating to the type inference utilities
   */
  private inferType(expr: any, accept: ValidationAcceptor): string | undefined {
    if (!expr) return undefined;

    // 1) Binary expression (e.g., 1 + 2, x > y)
    if (isBinExpr(expr)) {
      const left = this.inferType(expr.e1, accept);
      const right = this.inferType(expr.e2, accept);
      return inferBinaryExpressionType(expr, left, right, expr.op, accept);
    }

    // 2) Unary expressions (negation, not, parenthesized)
    if (
      expr.$type === "NegExpr" ||
      expr.$type === "NotExpr" ||
      expr.$type === "ParenExpr"
    ) {
      return inferUnaryExpressionType(this.inferType(expr.expr, accept));
    }

    // 3) Reference expressions (variable, enum, etc.)
    if (expr.$type === "Ref") {
      return this.inferReferenceType(expr, accept);
    }

    // 4) Case literal with enum member
    if (isCaseLiteral(expr)) {
      return inferCaseLiteralType(expr, accept);
    }

    // 5) Array literal
    if (isArrayLiteral(expr.val)) {
      return inferArrayLiteralType(
        expr,
        expr.val,
        this.inferType.bind(this),
        accept
      );
    }

    // 6) Struct literal
    if (isStructLiteral(expr.val)) {
      return "STRUCT";
    }

    // 7) Primitive literals (numbers, strings, booleans)
    return inferPrimitiveLiteralType(expr);
  }
  /**
   * Infers the type of a reference expression (variable, field access, array indexing)
   */
  private inferReferenceType(
    expr: any,
    accept: ValidationAcceptor
  ): string | undefined {
    const ref = expr.ref?.ref;
    if (!ref) return undefined;

    const type = this.inferBasicReferenceType(ref, expr, accept);

    // Check array indices if this is an indexed access
    if (ref && expr.indices.length > 0) {
      ArrayValidationUtils.validateArrayIndices(
        ref,
        expr,
        accept,
        this.inferType.bind(this)
      );
    }

    return type;
  }

  /**
   * Infers the basic type of a reference before processing properties/indexing
   */
  private inferBasicReferenceType(
    ref: any,
    expr: any,
    accept: ValidationAcceptor
  ): string | undefined {
    // Variable reference
    if (isVarDecl(ref)) {
      return this.processVariableReference(ref, expr, accept);
    }
    // Datapoint reference
    else if (isDatapoint(ref)) {
      return inferDatapointChannelType(ref, expr);
    }
    // Enum declaration reference
    else if (isEnumDecl(ref)) {
      return inferEnumDeclType(ref);
    }

    return undefined;
  }

  /**
   * Processes variable reference with array indexing and struct properties
   */
  private processVariableReference(
    ref: any,
    expr: any,
    accept: ValidationAcceptor
  ): string | undefined {
    let type = inferVarDeclType(ref);

    // First: Apply array indexing if needed
    if (expr.indices.length > 0 && type) {
      type = applyArrayIndexing(expr, type, accept);
      if (!type) return undefined;
    }

    // Then: Process struct properties
    for (const prop of expr.properties) {
      type = inferStructPropertyType(expr, type!, prop, accept);
      if (!type) return undefined;
    }

    return type;
  }

  checkEdgeSignalType(
    stmt: OnRisingEdgeStmt | OnFallingEdgeStmt,
    accept: ValidationAcceptor
  ) {
    const signal = stmt.signal;
    if (!signal) return;

    const signalType = this.inferType(signal, accept);
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
