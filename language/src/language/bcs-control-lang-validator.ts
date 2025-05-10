import { AstUtils, ValidationAcceptor, ValidationChecks } from "langium";
import { BCSControlLangServices } from "./bcs-control-lang-module.js";
import {
  ArrayLiteral,
  AssignmentStmt,
  BCSEngineeringDSLAstType,
  CaseLiteral,
  Channel,
  ControlModel,
  ControlUnit,
  ForStmt,
  FunctionBlockDecl,
  isArrayLiteral,
  isAssignmentStmt,
  isBinExpr,
  isCaseLiteral,
  isChannel,
  isControlModel,
  isDatapoint,
  isEnumDecl,
  isFunctionBlockDecl,
  isFunctionBlockInputs,
  isFunctionBlockLocals,
  isFunctionBlockLogic,
  isFunctionBlockOutputs,
  isPrimary,
  isStructDecl,
  isStructLiteral,
  isTypeAlias,
  isVarDecl,
  Primary,
  StructDecl,
  StructLiteral,
  SwitchStmt,
  UseOutput,
  UseStmt,
  VarDecl,
} from "./generated/ast.js";
import { getInputs, getOutputs } from "./utils/function-block-utils.js";
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
  validateArrayIndex,
  inferCaseLiteralType,
} from "./utils/type-inference-utils.js";
import { DuplicationValidator } from "./utils/duplication-validation-utils.js";

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
      validator.checkUniqueVarNamesInUnit,
      validator.checkScanCycleUnits,
      validator.checkWhenConditionType,
      validator.checkNestedVarDuplicates,
    ],
    ControlModel: [validator.checkUniqueEnumsAndTypesAndUnits],
    AssignmentStmt: [
      validator.checkAssignmentTypes,
      validator.checkNoWriteToInputDatapoints,
    ],
    VarDecl: [validator.checkVarDeclTypes],
    UseStmt: [validator.checkUseStmtTypes],
    SwitchStmt: [validator.checkSwitchCaseTypes],
    ForStmt: [validator.checkToExprType],
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
          this.isTypeAssignable(litType, switchType);

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
  checkNestedVarDuplicates(unit: ControlUnit, accept: ValidationAcceptor) {
    DuplicationValidator.checkNestedScopeVariableDuplicates(unit, accept);
  }

  checkUniqueVarNamesInFunctionBlock(
    fb: FunctionBlockDecl,
    accept: ValidationAcceptor
  ) {
    DuplicationValidator.checkUniqueVarNamesInFunctionBlock(fb, accept);
  }

  checkUniqueVarNamesInUnit(unit: ControlUnit, accept: ValidationAcceptor) {
    DuplicationValidator.checkUniqueVarNamesInUnit(unit, accept);
  }

  checkUniqueEnumsAndTypesAndUnits(
    model: ControlModel,
    accept: ValidationAcceptor
  ) {
    DuplicationValidator.checkUniqueGlobalDeclarations(model, accept);
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

    this.validateFunctionBlockInputs(useStmt, fb, accept);
    this.validateFunctionBlockOutputs(useStmt, fb, accept);
  }

  private validateFunctionBlockInputs(
    useStmt: UseStmt,
    fb: FunctionBlockDecl,
    accept: ValidationAcceptor
  ) {
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
    DuplicationValidator.checkDuplicateInputMappings(useStmt, fb, accept);
  }

  private validateInputTypes(
    useStmt: UseStmt,
    fb: FunctionBlockDecl,
    accept: ValidationAcceptor
  ) {
    for (const arg of useStmt.inputArgs) {
      const inputVarName = arg.inputVar.ref?.name;
      if (!inputVarName) continue;

      const paramDecl = getInputs(fb).find((i) => i.name === inputVarName);
      const expectedType = this.inferVarDeclType(paramDecl);
      const actualType = this.inferType(arg.value, accept);

      if (
        expectedType &&
        actualType &&
        !this.isTypeAssignable(actualType, expectedType)
      ) {
        accept(
          "error",
          `Type mismatch for input '${inputVarName}': expected '${expectedType}', got '${actualType}'.`,
          { node: arg.value }
        );
      }
    }
  }

  private validateFunctionBlockOutputs(
    useStmt: UseStmt,
    fb: FunctionBlockDecl,
    accept: ValidationAcceptor
  ) {
    const output = useStmt.useOutput;
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

  private validateSingleOutput(
    useStmt: UseStmt,
    fb: FunctionBlockDecl,
    output: UseOutput,
    accept: ValidationAcceptor
  ) {
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
      const expectedType = this.inferVarDeclType(expected);
      const actualType = this.inferVarDeclType(actual);

      if (
        expectedType &&
        actualType &&
        !this.isTypeAssignable(expectedType, actualType)
      ) {
        accept(
          "error",
          `Type mismatch for output '${expected.name}': cannot assign to '${actual.name}' of type '${actualType}', expected '${expectedType}'.`,
          { node: output.singleOutput!, property: "targetOutputVar" }
        );
      }
    }
  }

  private validateMappedOutputs(
    useStmt: UseStmt,
    fb: FunctionBlockDecl,
    output: UseOutput,
    accept: ValidationAcceptor
  ) {
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
      const expectedType = expected
        ? this.inferVarDeclType(expected)
        : undefined;
      const actualType = this.inferVarDeclType(targetOutputVar);

      if (
        expectedType &&
        actualType &&
        !this.isTypeAssignable(expectedType, actualType)
      ) {
        accept(
          "error",
          `Type mismatch for mapped output '${fbOutputVar.name}': expected '${expectedType}', got '${actualType}'.`,
          { node: map, property: "fbOutputVar" }
        );
      }
    }
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
    // 1. Infer and validate the declared type
    const type = this.inferVarDeclType(varDecl);
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
    this.checkArraySizeConsistency(varDecl, accept);
  }

  /**
   * Reports an error when the variable declaration type cannot be inferred
   */
  private reportNoTypeError(
    varDecl: VarDecl,
    accept: ValidationAcceptor
  ): void {
    accept(
      "error",
      `Cannot infer type for variable declaration: ${varDecl.name}`,
      { node: varDecl, property: "typeRef" }
    );
  }

  /**
   * Checks that the initializer's type is compatible with the variable's declared type
   */
  private checkInitializerTypeCompatibility(
    varDecl: VarDecl,
    declaredType: string,
    accept: ValidationAcceptor
  ): void {
    const initType = this.inferType(varDecl.init, accept);
    if (!initType) {
      this.reportNoInitTypeError(varDecl, accept);
      return;
    }

    // Handle struct literals which require special validation
    if (declaredType.startsWith("STRUCT:") && initType === "STRUCT") {
      this.validateStructLiteralAssignment(varDecl, accept);
      return;
    }

    // Handle struct array literals which require element-wise validation
    if (this.isStructArrayAssignment(declaredType, initType)) {
      this.validateStructArrayAssignment(varDecl, declaredType, accept);
      return;
    }

    // Regular type compatibility check
    if (!this.isTypeAssignable(initType, declaredType)) {
      this.reportTypeMismatchError(varDecl, initType, declaredType, accept);
    }
  }

  /**
   * Reports an error when the initializer type cannot be inferred
   */
  private reportNoInitTypeError(
    varDecl: VarDecl,
    accept: ValidationAcceptor
  ): void {
    accept(
      "error",
      `Cannot infer type for variable initialization: ${
        varDecl.name
      } = ${this.stringifyExpression(varDecl.init)}`,
      { node: varDecl, property: "init" }
    );
  }

  /**
   * Reports a type mismatch error between initializer and variable declaration
   */
  private reportTypeMismatchError(
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

  /**
   * Determines if we're dealing with a struct array assignment that needs special handling
   */
  private isStructArrayAssignment(
    declaredType: string,
    initType: string
  ): boolean {
    return (
      initType.startsWith("ARRAY<STRUCT>") &&
      declaredType.startsWith("ARRAY<STRUCT:")
    );
  }

  /**
   * Validates struct array assignment by checking each element against the expected struct type
   */
  private validateStructArrayAssignment(
    varDecl: VarDecl,
    declaredType: string,
    accept: ValidationAcceptor
  ): void {
    const expectedStructName = /^ARRAY<STRUCT:(.+?)>\[/.exec(declaredType)?.[1];
    if (!expectedStructName) return;

    if (isPrimary(varDecl.init) && isArrayLiteral(varDecl.init.val)) {
      for (const element of varDecl.init.val.elements) {
        if (isPrimary(element) && isStructLiteral(element.val)) {
          this.validateStructLiteralAssignment(
            element,
            accept,
            expectedStructName
          );
        }
      }
    }
  }

  /**
   * Checks that array initializer sizes match the declared dimensions
   */
  private checkArraySizeConsistency(
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
  private hasArrayTypeWithSizes(varDecl: VarDecl): boolean {
    return !!varDecl.typeRef?.sizes.length;
  }

  /**
   * Checks if the variable has an array literal as initializer
   */
  private hasArrayLiteralInit(varDecl: VarDecl): boolean {
    return isPrimary(varDecl.init) && isArrayLiteral(varDecl.init.val);
  }

  /**
   * Extracts array dimensions from size expressions
   */
  private extractArrayDimensions(sizeExprs: any[]): number[] {
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
    const leftType = this.inferType(stmt.target, accept);
    const rightType = this.inferType(stmt.value, accept);

    this.checkArrayIndexTypes(stmt.target, accept);
    this.checkArrayIndexTypes(stmt.value, accept);

    if (!leftType || !rightType) {
      accept(
        "warning",
        `Cannot infer type for assignment: ${
          stmt.target.ref.ref?.name
        } = ${this.stringifyExpression(stmt.value)}`,
        { node: stmt }
      );
      return;
    }

    if (leftType.startsWith("STRUCT:") && rightType === "STRUCT") {
      this.validateStructLiteralAssignment(stmt, accept);
      return;
    }

    if (!this.isTypeAssignable(rightType, leftType)) {
      accept(
        "error",
        `Type mismatch: Cannot assign "${rightType}" to "${leftType}".`,

        { node: stmt, property: "value" }
      );
    }
  }

  private stringifyExpression(expr: any): string {
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
          if (Array.isArray(expr.val?.elements)) {
            // It's an ArrayLiteral
            return `[${expr.val.elements
              .map((e: any) => this.stringifyExpression(e))
              .join(", ")}]`;
          }
          if (Array.isArray(expr.val?.fields)) {
            // It's a StructLiteral
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

  private validateStructLiteralAssignment(
    node: VarDecl | AssignmentStmt | Primary,
    accept: ValidationAcceptor,
    forceStructName?: string
  ) {
    const structInfo = this.extractStructInfo(node, forceStructName);
    if (!structInfo) return;

    const { structName, valueExpr, structLiteral } = structInfo;

    // lookup struct
    const structDecl = this.findStructDeclaration(node, structName);
    if (!structDecl) return;

    this.validateStructFields(
      structName,
      structLiteral,
      structDecl,
      valueExpr,
      accept
    );
  }

  private extractStructInfo(
    node: VarDecl | AssignmentStmt | Primary,
    forceStructName?: string
  ): { structName: string; valueExpr: any; structLiteral: any } | undefined {
    let structName: string | undefined;
    let valueExpr: any;

    if (isVarDecl(node)) {
      const typeDecl = node.typeRef?.ref?.ref;
      if (!isStructDecl(typeDecl)) return undefined;
      structName = typeDecl.name;
      valueExpr = node.init;
    } else if (isAssignmentStmt(node)) {
      structName = node.target.ref?.ref?.name;
      valueExpr = node.value;
    } else if (isPrimary(node)) {
      // case for array elements
      structName = forceStructName;
      valueExpr = node;
    } else {
      return undefined;
    }

    if (!structName || !valueExpr) {
      return undefined;
    }

    if (!isPrimary(valueExpr)) {
      return undefined;
    }

    const structLiteral = valueExpr.val;

    if (!isStructLiteral(structLiteral)) {
      return undefined;
    }

    return { structName, valueExpr, structLiteral };
  }

  private findStructDeclaration(
    node: VarDecl | AssignmentStmt | Primary,
    structName: string
  ): StructDecl | undefined {
    const controlModel = AstUtils.getContainerOfType(node, isControlModel);
    if (!controlModel) return undefined;

    return (
      (controlModel.controlBlock.items.find(
        (d) => isStructDecl(d) && d.name === structName
      ) as StructDecl | undefined) ??
      (controlModel.externTypeDecls.find(
        (d) => isStructDecl(d) && d.name === structName
      ) as StructDecl | undefined)
    );
  }

  private validateStructFields(
    structName: string,
    structLiteral: StructLiteral,
    structDecl: StructDecl,
    valueExpr: any,
    accept: ValidationAcceptor
  ): void {
    const expectedFields = new Set(structDecl.fields.map((f) => f.name));
    const givenFields = new Set(structLiteral.fields.map((f) => f.name));

    // Check for duplicate fields in the literal
    this.checkDuplicateFields(structName, structLiteral, accept);

    // Check for unexpected fields in the literal
    let hasUnexpectedField = this.checkUnexpectedFields(
      structName,
      givenFields,
      expectedFields,
      valueExpr,
      accept
    );

    // Check for missing fields
    if (!hasUnexpectedField) {
      this.checkMissingFields(
        structName,
        givenFields,
        expectedFields,
        valueExpr,
        accept
      );
    }
  }

  private checkDuplicateFields(
    structName: string,
    structLiteral: any,
    accept: ValidationAcceptor
  ): void {
    const seenFields = new Set<string>();
    for (const field of structLiteral.fields) {
      if (seenFields.has(field.name)) {
        accept(
          "error",
          `Duplicate field '${field.name}' in struct literal for '${structName}'.`,
          { node: field }
        );
      } else {
        seenFields.add(field.name);
      }
    }
  }

  private checkUnexpectedFields(
    structName: string,
    givenFields: Set<string>,
    expectedFields: Set<string>,
    valueExpr: any,
    accept: ValidationAcceptor
  ): boolean {
    let hasUnexpectedField = false;
    for (const given of givenFields) {
      if (!expectedFields.has(given)) {
        accept(
          "error",
          `Unexpected field '${given}' in struct literal for '${structName}'.`,
          { node: valueExpr }
        );
        hasUnexpectedField = true;
      }
    }
    return hasUnexpectedField;
  }

  private checkMissingFields(
    structName: string,
    givenFields: Set<string>,
    expectedFields: Set<string>,
    valueExpr: any,
    accept: ValidationAcceptor
  ): void {
    for (const expected of expectedFields) {
      if (!givenFields.has(expected)) {
        accept(
          "error",
          `Missing field '${expected}' in struct literal for '${structName}'.`,
          { node: valueExpr }
        );
      }
    }
  }

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

    let type: string | undefined;

    // Variable reference
    if (isVarDecl(ref)) {
      type = inferVarDeclType(ref);

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
    }
    // Datapoint reference
    else if (isDatapoint(ref)) {
      type = inferDatapointChannelType(ref, expr);
    }
    // Enum declaration reference
    else if (isEnumDecl(ref)) {
      type = inferEnumDeclType(ref);
    }

    // Check array indices if this is an indexed access
    if (ref && expr.indices.length > 0) {
      this.validateArrayIndices(ref, expr, accept);
    }

    return type;
  }

  /**
   * Validates the indices of an array reference expression
   */
  private validateArrayIndices(
    ref: any,
    expr: any,
    accept: ValidationAcceptor
  ): void {
    const sizes = ref.typeRef?.sizes ?? [];

    for (let i = 0; i < expr.indices.length && i < sizes.length; i++) {
      const indexExpr = expr.indices[i];
      const sizeExpr = sizes[i];

      // Validate index type
      const idxType = this.inferType(indexExpr, accept);
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

  private inferVarDeclType(varDecl: VarDecl | undefined): string | undefined {
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

  private validateArrayLiteralSize(
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

  checkArrayIndexTypes(expr: any, accept: ValidationAcceptor) {
    if (expr.$type === "Ref" && expr.indices.length > 0) {
      for (const idxExpr of expr.indices) {
        const idxType = this.inferType(idxExpr, accept);
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

  private isTypeAssignable(sourceType: string, targetType: string): boolean {
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
}
