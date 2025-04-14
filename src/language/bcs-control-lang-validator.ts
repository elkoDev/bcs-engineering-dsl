import { ValidationAcceptor, ValidationChecks } from "langium";
import { BCSControlLangServices } from "./bcs-control-lang-module.js";
import {
  AssignmentStmt,
  BCSEngineeringDSLAstType,
  ControlModel,
  ControlUnit,
  FunctionBlockDecl,
  isActuator,
  isControlUnit,
  isEnumDecl,
  isFunctionBlockDecl,
  isFunctionBlockInputs,
  isFunctionBlockLocals,
  isFunctionBlockLogic,
  isFunctionBlockOutputs,
  isSensor,
  isVarDecl,
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
    ],
    ControlModel: [validator.checkUniqueEnumsAndTypesAndUnits],
    AssignmentStmt: [validator.checkAssignmentTypes],
    VarDecl: [validator.checkVarDeclTypes],
    UseStmt: [validator.checkUseStmtTypes],
  };
  registry.register(checks, validator);
}

export class BCSControlLangValidator {
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
    const fbNames = new Set<string>();
    const unitNames = new Set<string>();
    const globalVarNames = new Set<string>();

    for (const item of model.items) {
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
    if (varDecl.init) {
      const initType = this.inferType(varDecl.init, accept);
      if (!initType) {
        accept(
          "error",
          `Cannot infer type for variable initialization: ${
            varDecl.name
          } = ${JSON.stringify(varDecl.init)}`,
          { node: varDecl, property: "init" }
        );
        return;
      }
      if (!this.isTypeAssignable(initType, type)) {
        accept(
          "error",
          `Type mismatch: Cannot assign "${initType}" to "${type}".`,
          { node: varDecl, property: "init" }
        );
      }
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
      default:
        if (typeof expr.val !== "undefined") {
          return `${expr.val}`;
        }
        return `[${expr.$type}]`;
    }
  }

  private inferType(expr: any, accept: ValidationAcceptor): string | undefined {
    if (!expr) return undefined;

    // 1) If BinaryExpr => check left and right side
    if (expr.$type === "BinExpr") {
      const left = this.inferType(expr.e1, accept);
      const right = this.inferType(expr.e2, accept);
      const op = expr.op;

      if (!left || !right) {
        return left ?? right;
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
      if (isVarDecl(ref)) {
        return this.inferVarDeclType(ref);
      }
      if (isSensor(ref) || isActuator(ref)) {
        return ref.dataType;
      }
      if (isEnumDecl(ref)) {
        return `Enum:${ref.name}`;
      }
      return this.inferVarDeclType(expr.ref?.ref);
    }

    // 4) If literal => check type
    if (typeof expr.val === "number") {
      const raw = expr.$cstNode?.text;

      if (raw?.includes(".")) {
        return "REAL";
      } else {
        return "INT";
      }
    }
    if (typeof expr.val === "boolean") {
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
    return undefined;
  }

  private inferVarDeclType(varDecl: VarDecl | undefined): string | undefined {
    if (!varDecl) return undefined;
    if (!varDecl.typeRef) return undefined;

    // Either builtin DataType => "BOOL"/"INT"/"REAL"/"STRING" etc.
    if (varDecl.typeRef.type) {
      return varDecl.typeRef.type;
    }

    // Or referencing (EnumDecl | FunctionBlockDecl)
    if (varDecl.typeRef.ref) {
      const typeDecl = varDecl.typeRef.ref.ref;
      if (!typeDecl) return undefined;
      if (isEnumDecl(typeDecl)) {
        return `Enum:${typeDecl.name}`;
      }
      // Ist es ein FunctionBlockDecl?
      if (isFunctionBlockDecl(typeDecl)) {
        return `FB:${typeDecl.name}`;
      }
    }

    return undefined;
  }

  private isTypeAssignable(sourceType: string, targetType: string): boolean {
    if (sourceType === targetType) return true;

    if (sourceType === "INT" && targetType === "REAL") {
      return true;
    }

    // e.g. source="Enum:Color" target="Enum:Color"
    if (sourceType.startsWith("Enum:") && targetType === sourceType) {
      return true;
    }

    return false;
  }

  private areTypesComparable(type1: string, type2: string): boolean {
    const comparableGroups: string[][] = [
      ["INT", "REAL"],
      ["STRING"],
      ["BOOL"],
    ];

    for (const group of comparableGroups) {
      if (group.includes(type1) && group.includes(type2)) {
        return true;
      }
    }

    return false;
  }
}
