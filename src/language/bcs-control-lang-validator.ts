import { ValidationAcceptor, ValidationChecks } from "langium";
import { BCSControlLangServices } from "./bcs-control-lang-module.js";
import {
  AssignmentStmt,
  BCSEngineeringDSLAstType,
  ControlUnit,
  FunctionBlockDecl,
  isActuator,
  isEnumDecl,
  isFunctionBlockDecl,
  isSensor,
  isVarDecl,
  VarDecl,
} from "./generated/ast.js";

export function registerBCSControlValidationChecks(
  services: BCSControlLangServices
) {
  const registry = services.validation.ValidationRegistry;
  const validator = services.validation.BCSControlLangValidator;
  const checks: ValidationChecks<BCSEngineeringDSLAstType> = {
    FunctionBlockDecl: [validator.checkUniqueVarNamesInFunctionBlock],
    ControlUnit: [validator.checkUniqueVarNamesInUnit],
    AssignmentStmt: [validator.checkAssignmentTypes],
    VarDecl: [validator.checkVarDeclTypes],
    //UseStmt: [validator.checkUseStmtTypes], TODO
  };
  registry.register(checks, validator);
}

export class BCSControlLangValidator {
  //private readonly services: BCSControlLangServices;

  constructor(services: BCSControlLangServices) {
    //this.services = services;
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
      ...(fb.inputs ?? []),
      ...(fb.outputs ?? []),
      ...(fb.locals ?? []),
    ];
    // Also gather 'LocalVarDeclStmt' from logic statements, if you want
    for (const stmt of fb.stmts) {
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
    if (typeof expr === "object" && expr !== null) {
      if (expr.$type) {
        return `[${expr.$type}]`;
      }
      return JSON.stringify(expr);
    }
    return String(expr);
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

      if ((op === "&&" || op === "||") && left === "BOOL" && right === "BOOL") {
        return "BOOL";
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
      if (expr.val.toString().includes(".")) {
        return "REAL";
      } else if (Number.isFinite(expr.val)) {
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
