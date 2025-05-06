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
  FunctionBlockDecl,
  isArrayLiteral,
  isAssignmentStmt,
  isBinExpr,
  isCaseLiteral,
  isChannel,
  isControlModel,
  isControlUnit,
  isDatapoint,
  isEnumDecl,
  isForStmt,
  isFunctionBlockDecl,
  isFunctionBlockInputs,
  isFunctionBlockLocals,
  isFunctionBlockLogic,
  isFunctionBlockOutputs,
  isIfStmt,
  isOnFallingEdgeStmt,
  isOnRisingEdgeStmt,
  isPrimary,
  isStructDecl,
  isStructLiteral,
  isSwitchStmt,
  isVarDecl,
  isWhileStmt,
  Primary,
  StructDecl,
  StructLiteral,
  SwitchStmt,
  UseStmt,
  VarDecl,
} from "./generated/ast.js";
import {
  getInputs,
  getOutputs,
  getLocals,
  getLogic,
} from "./utils/function-block-utils.js";
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

export function registerBCSControlValidationChecks(
  services: BCSControlLangServices
) {
  const registry = services.validation.ValidationRegistry;
  const validator = services.validation.BCSControlLangValidator;
  const checks: ValidationChecks<BCSEngineeringDSLAstType> = {
    FunctionBlockDecl: [
      validator.checkUniqueVarNamesInFunctionBlock,
      validator.checkSingleBlockSectionsInFunctionBlock,
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
  };
  registry.register(checks, validator);
}

export class BCSControlLangValidator {
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
    const model = unit.$container;
    const globalNames = new Set(
      model.items.filter(isVarDecl).map((v) => v.name)
    );

    this.validateBlock(unit.stmts, globalNames, accept);
  }

  private validateBlock(
    stmts: Array<any>,
    outerNames: Set<string>,
    accept: ValidationAcceptor
  ) {
    const local = new Set<string>();
    const withOuter = () => new Set([...outerNames, ...local]);

    const add = (v: VarDecl) => {
      const name = v.name;
      if (local.has(name) || outerNames.has(name)) {
        accept("error", `Duplicate variable '${name}' in this scope.`, {
          node: v,
          property: "name",
        });
      } else {
        local.add(name);
      }
    };

    for (const s of stmts) {
      if (isVarDecl(s)) {
        add(s);
      } else if (isIfStmt(s)) {
        this.validateBlock(s.stmts, withOuter(), accept);
        for (const e of s.elseIfStmts)
          this.validateBlock(e.stmts, withOuter(), accept);
        if (s.elseStmt)
          this.validateBlock(s.elseStmt.stmts, withOuter(), accept);
      } else if (
        isWhileStmt(s) ||
        isOnRisingEdgeStmt(s) ||
        isOnFallingEdgeStmt(s)
      ) {
        this.validateBlock(s.stmts, withOuter(), accept);
      } else if (isForStmt(s)) {
        if (s.loopVar) add(s.loopVar);
        this.validateBlock(s.stmts, withOuter(), accept);
      } else if (isSwitchStmt(s)) {
        for (const c of s.cases)
          this.validateBlock(c.stmts, withOuter(), accept);
        if (s.default) this.validateBlock(s.default.stmts, withOuter(), accept);
      }
    }
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

  checkUniqueEnumsAndTypesAndUnits(
    model: ControlModel,
    accept: ValidationAcceptor
  ) {
    const enumNames = new Set<string>();
    const structNames = new Set<string>();
    const fbNames = new Set<string>();
    const unitNames = new Set<string>();
    const globalVarNames = new Set<string>();

    for (const item of model.controlBlock?.items ?? []) {
      if (isStructDecl(item)) {
        if (structNames.has(item.name)) {
          accept("error", `Duplicate struct '${item.name}'.`, {
            node: item,
            property: "name",
          });
        } else {
          structNames.add(item.name);
        }
      }
      if (isEnumDecl(item)) {
        if (enumNames.has(item.name)) {
          accept("error", `Duplicate enum '${item.name}'.`, {
            node: item,
            property: "name",
          });
        } else {
          enumNames.add(item.name);
        }
      }
      if (isFunctionBlockDecl(item)) {
        if (fbNames.has(item.name)) {
          accept("error", `Duplicate function block '${item.name}'.`, {
            node: item,
            property: "name",
          });
        } else {
          fbNames.add(item.name);
        }
      }
      if (isControlUnit(item)) {
        if (unitNames.has(item.name)) {
          accept("error", `Duplicate control unit '${item.name}'.`, {
            node: item,
            property: "name",
          });
        } else {
          unitNames.add(item.name);
        }
      }
      if (isVarDecl(item)) {
        if (globalVarNames.has(item.name)) {
          accept("error", `Duplicate global variable '${item.name}'.`, {
            node: item,
            property: "name",
          });
        } else {
          globalVarNames.add(item.name);
        }
      }
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

  /**
   * Validates that all variable names within a given function block are unique.
   * This includes inputs, outputs, local variables, and variables declared within logic statements.
   *
   * @param fb - The function block declaration to validate.
   * @param accept - A callback function to report validation issues.
   *                 It accepts the severity level, a message, and additional context.
   *
   * The function checks for duplicate variable names across:
   * - Input variables (`fb.inputs`)
   * - Output variables (`fb.outputs`)
   * - Local variables (`fb.locals`)
   * - Variables declared in logic statements (`LocalVarDeclStmt`)
   *
   * If a duplicate variable name is found, an error is reported using the `accept` function.
   */
  checkUniqueVarNamesInFunctionBlock(
    fb: FunctionBlockDecl,
    accept: ValidationAcceptor
  ) {
    const allVars: VarDecl[] = [
      ...getInputs(fb),
      ...getOutputs(fb),
      ...getLocals(fb),
    ];
    for (const stmt of getLogic(fb)?.stmts ?? []) {
      if (isVarDecl(stmt)) {
        allVars.push(stmt);
      }
    }

    const seen = new Set<string>();
    for (const v of allVars) {
      if (seen.has(v.name)) {
        accept(
          "error",
          `Duplicate variable name '${v.name}' in function block '${fb.name}'.`,
          { node: v, property: "name" }
        );
      } else {
        seen.add(v.name);
      }
    }
  }

  /**
   * Checks for duplicate variable names within a given control unit and reports errors
   * if any duplicates are found.
   *
   * @param unit - The control unit to validate, containing a list of statements.
   * @param accept - A function used to report validation issues, such as duplicate variable names.
   *
   * This function iterates through all variable declarations (`VarDecl`) in the provided
   * control unit's statements, ensuring that each variable name is unique. If a duplicate
   * variable name is detected, an error is reported using the `accept` function.
   */
  checkUniqueVarNamesInUnit(unit: ControlUnit, accept: ValidationAcceptor) {
    const allVars: VarDecl[] = [];
    // gather statements
    for (const s of unit.stmts) {
      if (isVarDecl(s)) {
        allVars.push(s);
      }
    }
    const seen = new Set<string>();
    for (const v of allVars) {
      if (seen.has(v.name)) {
        accept(
          "error",
          `Duplicate local var name '${v.name}' in unit '${unit.name}'.`,
          {
            node: v,
            property: "name",
          }
        );
      } else {
        seen.add(v.name);
      }
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
    this.checkDuplicateInputMappings(useStmt, fb, accept);
  }

  private validateInputTypes(
    useStmt: UseStmt,
    fb: FunctionBlockDecl,
    accept: ValidationAcceptor
  ) {
    for (const arg of useStmt.inputArgs) {
      const paramName = arg.inputVar.ref?.name;
      const paramDecl = getInputs(fb).find((i) => i.name === paramName);
      const expectedType = this.inferVarDeclType(paramDecl);
      const actualType = this.inferType(arg.value, accept);

      if (
        expectedType &&
        actualType &&
        !this.isTypeAssignable(actualType, expectedType)
      ) {
        accept(
          "error",
          `Type mismatch for input '${paramName}': expected '${expectedType}', got '${actualType}'.`,
          { node: arg.value }
        );
      }
    }
  }

  private checkDuplicateInputMappings(
    useStmt: UseStmt,
    fb: FunctionBlockDecl,
    accept: ValidationAcceptor
  ) {
    const seenInputs = new Set<string>();
    for (const arg of useStmt.inputArgs) {
      const varName = arg.inputVar.ref?.name;
      if (varName) {
        if (seenInputs.has(varName)) {
          accept(
            "error",
            `Duplicate mapping for input '${varName}' in use of function block '${fb.name}'.`,
            { node: arg, property: "inputVar" }
          );
        }
        seenInputs.add(varName);
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

    // 4) Single output result (direct reference)
    if (isSingle) {
      this.validateSingleOutput(useStmt, fb, output, accept);
    }
    // 5) Output mapping list (explicit mappings)
    else if (isMapping) {
      this.validateMappedOutputs(useStmt, fb, output, accept);
    }
    // 6) No outputs provided
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
    output: any,
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
    const actual = output.singleOutput!.outputVar?.ref;

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
          { node: output.singleOutput!, property: "outputVar" }
        );
      }
    }
  }

  private validateMappedOutputs(
    useStmt: UseStmt,
    fb: FunctionBlockDecl,
    output: any,
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

    this.checkDuplicateAndTypesMappedOutputs(useStmt, fb, output, accept);
  }

  private checkDuplicateAndTypesMappedOutputs(
    useStmt: UseStmt,
    fb: FunctionBlockDecl,
    output: any,
    accept: ValidationAcceptor
  ) {
    const seen = new Set<string>();
    for (const map of output.mappingOutputs) {
      const targetVar = map.outputVar?.ref;
      const fbOutputVar = map.fbOutput?.ref;

      if (!targetVar || !fbOutputVar) continue;

      if (seen.has(targetVar.name)) {
        accept(
          "error",
          `Duplicate output mapping to variable '${targetVar.name}' in use of '${fb.name}'.`,
          { node: map, property: "outputVar" }
        );
      }
      seen.add(targetVar.name);

      const expected = getOutputs(fb).find((o) => o.name === targetVar.name);
      const expectedType = expected
        ? this.inferVarDeclType(expected)
        : undefined;
      const actualType = this.inferVarDeclType(fbOutputVar);

      if (
        expectedType &&
        actualType &&
        !this.isTypeAssignable(expectedType, actualType)
      ) {
        accept(
          "error",
          `Type mismatch for mapped output '${targetVar.name}': expected '${expectedType}', got '${actualType}'.`,
          { node: map, property: "outputVar" }
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
    const type = this.inferVarDeclType(varDecl);
    if (!type) {
      accept(
        "error",
        `Cannot infer type for variable declaration: ${varDecl.name}`,
        { node: varDecl, property: "typeRef" }
      );
      return;
    }

    let initType: string | undefined;

    if (varDecl.init) {
      initType = this.inferType(varDecl.init, accept);
      if (!initType) {
        accept(
          "error",
          `Cannot infer type for variable initialization: ${
            varDecl.name
          } = ${this.stringifyExpression(varDecl.init)}`,
          { node: varDecl, property: "init" }
        );
        return;
      }

      if (type.startsWith("STRUCT:") && initType === "STRUCT") {
        this.validateStructLiteralAssignment(varDecl, accept);
        return;
      }

      // Special case: Struct array assignment
      if (
        initType.startsWith("ARRAY<STRUCT>") &&
        type.startsWith("ARRAY<STRUCT:")
      ) {
        const expectedStructName = /^ARRAY<STRUCT:(.+?)>\[/.exec(type)?.[1];
        if (expectedStructName) {
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
        return; // Struct array case handled already, no normal type check needed
      }

      // Regular type mismatch check
      if (!this.isTypeAssignable(initType, type)) {
        accept(
          "error",
          `Type mismatch: Cannot assign "${initType}" to "${type}".`,
          { node: varDecl, property: "init" }
        );
      }
    }

    // Array Size Checking
    if (
      varDecl.typeRef?.sizes.length > 0 &&
      isPrimary(varDecl.init) &&
      isArrayLiteral(varDecl.init.val)
    ) {
      const expectedDimensions: number[] = [];

      for (const sizeExpr of varDecl.typeRef.sizes) {
        if (sizeExpr.$type === "Primary" && typeof sizeExpr.val === "number") {
          expectedDimensions.push(sizeExpr.val);
        } else {
          console.log("Skipping size validation: complex size expression.");
          return;
        }
      }

      this.validateArrayLiteralSize(
        varDecl.init.val,
        expectedDimensions,
        accept,
        varDecl
      );
    }
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
