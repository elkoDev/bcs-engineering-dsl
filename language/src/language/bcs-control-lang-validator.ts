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
  isEnumMemberLiteral,
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

    // 3) Check: Duplicate input mappings
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

    // 5) Output mapping list (explicit mappings)
    else if (isMapping) {
      if (output.mappingOutputs.length !== getOutputs(fb).length) {
        accept(
          "error",
          `Function block '${fb.name}' expects ${
            getOutputs(fb).length
          } outputs, but got ${output.mappingOutputs.length}.`,
          { node: useStmt, property: "useOutput" }
        );
      }

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
    let structName: string | undefined;
    let valueExpr: any;

    if (isVarDecl(node)) {
      const typeDecl = node.typeRef?.ref?.ref;
      if (!isStructDecl(typeDecl)) return;
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
      return;
    }

    if (!structName || !valueExpr) {
      return;
    }

    if (!isPrimary(valueExpr)) {
      return;
    }

    const structLiteral = valueExpr.val;

    if (!isStructLiteral(structLiteral)) {
      return;
    }

    // lookup struct
    const controlModel = AstUtils.getContainerOfType(node, isControlModel);
    if (!controlModel) return;

    const structDecl =
      (controlModel.controlBlock.items.find(
        (d) => isStructDecl(d) && d.name === structName
      ) as StructDecl | undefined) ??
      (controlModel.externTypeDecls.find(
        (d) => isStructDecl(d) && d.name === structName
      ) as StructDecl | undefined);

    if (!structDecl) {
      return;
    }

    const expectedFields = new Set(structDecl.fields.map((f) => f.name));
    const givenFields = new Set(structLiteral.fields.map((f) => f.name));

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

    if (!hasUnexpectedField) {
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
  }

  private inferType(expr: any, accept: ValidationAcceptor): string | undefined {
    if (!expr) return undefined;

    // 1) If BinaryExpr => check left and right side
    if (isBinExpr(expr)) {
      const left = this.inferType(expr.e1, accept);
      const right = this.inferType(expr.e2, accept);
      const op = expr.op;

      if (!left || !right) {
        accept(
          "error",
          `Cannot infer operand types for '${this.stringifyExpression(expr)}'.`,
          { node: expr }
        );
        return undefined;
      }

      if (["==", "!=", "<", "<=", ">", ">="].includes(op)) {
        if (this.areTypesComparable(left, right)) {
          return "BOOL";
        } else {
          accept(
            "error",
            `Cannot compare values of types '${left}' and '${right}' with '${op}'.`,
            {
              node: expr,
            }
          );
          return undefined;
        }
      }

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
            {
              node: expr,
            }
          );
          return undefined;
        }
      }
      return undefined;
    }

    // 2) If Negation / Not / Paren
    if (
      expr.$type === "NegExpr" ||
      expr.$type === "NotExpr" ||
      expr.$type === "ParenExpr"
    ) {
      return this.inferType(expr.expr, accept);
    }

    // 3) If Ref => check what it points to
    if (expr.$type === "Ref") {
      const ref = expr.ref?.ref;
      if (!ref) return undefined;

      let type = undefined;

      if (isVarDecl(ref)) {
        type = this.inferVarDeclType(ref);

        // FIRST: Apply array indexing if needed
        if (expr.indices.length > 0 && type) {
          type = this.applyArrayIndexing(expr, type, accept);
          if (!type) return undefined;
        }

        // THEN: Walk over struct properties
        for (const prop of expr.properties) {
          if (!type?.startsWith("STRUCT:")) {
            accept(
              "error",
              `Cannot access property '${prop.ref?.name}' on non-struct type '${type}'.`,
              { node: expr }
            );
            return undefined;
          }

          const controlModel = AstUtils.getContainerOfType(
            expr,
            isControlModel
          );
          const structName = type.substring("STRUCT:".length);
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

          const field = structDecl.fields.find(
            (f) => f.name === prop.ref?.name
          );
          if (!field) {
            accept(
              "error",
              `Unknown field '${prop.ref?.name}' in struct '${structName}'.`,
              { node: expr }
            );
            return undefined;
          }

          // Update type
          if (field.typeRef?.type) {
            type = field.typeRef.type;
          } else if (field.typeRef?.ref?.ref) {
            const refTypeDecl = field.typeRef.ref.ref;
            if (isStructDecl(refTypeDecl)) {
              type = `STRUCT:${refTypeDecl.name}`;
            } else if (isEnumDecl(refTypeDecl)) {
              type = `ENUM:${refTypeDecl.name}`;
            }
          }
        }
      } else if (isDatapoint(ref)) {
        if (expr.properties.length === 1) {
          const channelRef = expr.properties[0]?.ref;
          if (isChannel(channelRef)) {
            type = channelRef.dataType;
          }
        }
      } else if (isEnumDecl(ref)) {
        type = `ENUM:${ref.name}`;
      }

      if (ref && expr.indices.length > 0) {
        if (isVarDecl(ref)) {
          const sizes = ref.typeRef?.sizes ?? [];

          for (let i = 0; i < expr.indices.length && i < sizes.length; i++) {
            const indexExpr = expr.indices[i];

            const idxType = this.inferType(indexExpr, accept);
            if (idxType !== "INT") {
              accept(
                "error",
                `Array index must be of type INT, but got "${idxType}".`,
                { node: indexExpr }
              );
            }

            const sizeExpr = sizes[i];

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
        }
      }

      return type;
    }

    // 4) If EnumMemberLiteral => check what it points to
    if (isCaseLiteral(expr)) {
      if (isEnumMemberLiteral(expr.val)) {
        return `ENUM:${expr.val.enumDecl.$refText}`;
      }
    }

    // 5) If literal => check type
    if (isArrayLiteral(expr.val)) {
      const arrayLiteral = expr.val as ArrayLiteral;
      const elements = arrayLiteral.elements;
      if (elements.length === 0) return "ARRAY<unknown>[0]";

      // Infer element types
      let firstElementType = this.inferType(elements[0], accept);

      // If first element is STRUCT but surrounded by a known typeRef, use that
      if (firstElementType === "STRUCT") {
        const parentVarDecl = AstUtils.getContainerOfType(expr, isVarDecl);
        const structDecl = parentVarDecl?.typeRef?.ref?.ref;
        if (isStructDecl(structDecl)) {
          firstElementType = `STRUCT:${structDecl.name}`;
        }
      }

      if (!firstElementType) return `ARRAY<unknown>[${elements.length}]`;

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
      const elementTypes = new Set(
        elements.map((e) => this.inferType(e, accept))
      );
      if (elementTypes.size > 1) {
        return `ARRAY<mixed>[${elements.length}]`;
      } else {
        const singleType = [...elementTypes][0];
        return `ARRAY<${singleType}>[${elements.length}]`;
      }
    }

    if (isStructLiteral(expr.val)) {
      return "STRUCT";
    }

    if (typeof expr.val === "number") {
      const raw = expr.$cstNode?.text;

      if (raw?.includes(".")) {
        return "REAL";
      } else {
        return "INT";
      }
    }
    if (typeof expr.val === "boolean" && expr.$cstNode?.text !== "now") {
      return "BOOL";
    }
    if (typeof expr.val === "string") {
      // "TOD#" => TIME OF DAY
      // "T#"   => TIME
      // "..."  => STRING
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

  private areTypesComparable(type1: string, type2: string): boolean {
    const comparableGroups: string[][] = [
      ["INT", "REAL"],
      ["STRING"],
      ["BOOL"],
      ["TOD"],
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

  private applyArrayIndexing(
    expr: any,
    type: string,
    accept: ValidationAcceptor
  ): string | undefined {
    let arrayMatch = /^ARRAY<(.+)>(\[(?:\d+|\?)+\])+$/u.exec(type);

    if (arrayMatch) {
      let baseType = arrayMatch[1];
      let dims = (type.match(/\[\d+|\?\]/g) || []).map((d) =>
        d.replace(/\[|\]/g, "")
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
}
