import { ValidationAcceptor, ValidationChecks } from "langium";
import { BCSControlLangServices } from "./bcs-control-lang-module.js";
import {
  BCSEngineeringDSLAstType,
  ControlUnit,
  FunctionBlockCallStmt,
  FunctionBlockDecl,
  isFunctionBlockDecl,
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
    FunctionBlockCallStmt: [validator.checkFunctionBlockCall],
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

  // TODO: not working yet
  checkFunctionBlockCall(
    stmt: FunctionBlockCallStmt,
    accept: ValidationAcceptor
  ): void {
    const targetDecl = stmt.target;

    // 1. Check that target resolves to a FunctionBlockDecl
    if (!targetDecl || !isFunctionBlockDecl(targetDecl)) {
      accept(
        "error",
        `Cannot resolve function block '${
          stmt.target.$cstNode?.text ?? "unknown"
        }'.`,
        {
          node: stmt.target,
        }
      );
      return;
    }

    // 2. Validate each arg exists in the inputs of the resolved FunctionBlockDecl
    for (const arg of stmt.args) {
      const found = (targetDecl as FunctionBlockDecl).inputs.some(
        (input) => input.name === arg.name
      );
      if (!found) {
        accept(
          "error",
          `Argument '${arg.name}' not found in inputs of function block '${
            (targetDecl as FunctionBlockDecl).name
          }'.`,
          {
            node: arg,
            property: "name",
          }
        );
      }
    }
  }
}
