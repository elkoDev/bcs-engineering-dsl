import { ValidationAcceptor } from "langium";
import {
  getInputs,
  getLogic,
  getLocals,
  getOutputs,
} from "./function-block-utils.js";
import {
  ControlUnit,
  isVarDecl,
  VarDecl,
  isForStmt,
  isIfStmt,
  isWhileStmt,
  isOnRisingEdgeStmt,
  isOnFallingEdgeStmt,
  isSwitchStmt,
  FunctionBlockDecl,
  UseStmt,
  UseOutput,
  ControlModel,
  isStructDecl,
  isEnumDecl,
  isFunctionBlockDecl,
  isControlUnit,
} from "../../generated/ast.js";

/**
 * Utility class for checking duplications in various AST constructs.
 * Contains methods to validate unique variable names across different scopes.
 */
export class DuplicationValidator {
  /**
   * Validates that top-level variable names within a control unit are unique
   * and don't conflict with global variables.
   *
   * @param unit The control unit to check
   * @param accept The validation acceptor for reporting errors
   */
  static checkTopLevelVarDuplicates(
    unit: ControlUnit,
    accept: ValidationAcceptor
  ) {
    const model = unit.$container;
    const globalVarNames = new Set(
      model.items.filter(isVarDecl).map((v) => v.name)
    );

    const localVarNames = new Set<string>();

    // Check only top-level variable declarations in the unit
    for (const stmt of unit.stmts) {
      if (isVarDecl(stmt)) {
        const name = stmt.name;

        // Check for conflicts with global variables
        if (globalVarNames.has(name)) {
          accept(
            "error",
            `Variable '${name}' conflicts with global variable.`,
            {
              node: stmt,
              property: "name",
            }
          );
        }
        // Check for duplicates within the same unit
        else if (localVarNames.has(name)) {
          accept(
            "error",
            `Duplicate variable '${name}' in unit '${unit.name}'.`,
            {
              node: stmt,
              property: "name",
            }
          );
        } else {
          localVarNames.add(name);
        }
      }
    }
  }

  /**
   * Validates that variable names within a block scope don't conflict with variables from
   * outer scopes or have duplicate declarations within the same scope.
   *
   * @param stmts The block statements to validate
   * @param outerNames Set of variable names from outer scopes
   * @param accept The validation acceptor for reporting errors
   */
  private static validateScopeBlockVariables(
    stmts: Array<any>,
    outerNames: Set<string>,
    accept: ValidationAcceptor
  ) {
    const localNames = new Set<string>();
    const allVisibleNames = () => new Set([...outerNames, ...localNames]);

    const addVariable = (v: VarDecl) =>
      this.checkAndAddVariable(v, localNames, outerNames, accept);

    for (const stmt of stmts) {
      if (isVarDecl(stmt)) {
        addVariable(stmt);
      } else {
        this.validateStatementScope(
          stmt,
          allVisibleNames(),
          accept,
          addVariable
        );
      }
    }
  }

  /**
   * Checks if a variable name would conflict with existing variables and adds it to the local set
   * if no conflicts exist.
   *
   * @param varDecl The variable declaration to check
   * @param localNames Set of local variable names in current scope
   * @param outerNames Set of variable names from outer scopes
   * @param accept The validation acceptor for reporting errors
   */
  private static checkAndAddVariable(
    varDecl: VarDecl,
    localNames: Set<string>,
    outerNames: Set<string>,
    accept: ValidationAcceptor
  ) {
    // Allow loop variables (ForStmt.loopVar) to shadow and repeat in neighbor scopes
    const container = (varDecl as any).$container;
    if (container && isForStmt(container) && container.loopVar === varDecl) {
      // Skip duplicate check for loop variables
      // (This allows shadowing and reuse of the same name in nested/neighboring loops)
      localNames.add(varDecl.name);
      return;
    }
    const name = varDecl.name;
    if (localNames.has(name) || outerNames.has(name)) {
      accept("error", `Duplicate variable '${name}' in this scope.`, {
        node: varDecl,
        property: "name",
      });
    } else {
      localNames.add(name);
    }
  }

  /**
   * Validates variable scopes for different statement types that can create new scopes.
   *
   * @param stmt The statement to validate
   * @param outerNames Set of visible variable names from outer scopes
   * @param accept The validation acceptor for reporting errors
   * @param addVariable Function to add a variable to the current scope
   */
  private static validateStatementScope(
    stmt: any,
    outerNames: Set<string>,
    accept: ValidationAcceptor,
    addVariable: (v: VarDecl) => void
  ) {
    if (isIfStmt(stmt)) {
      this.validateIfStatementScope(stmt, outerNames, accept);
    } else if (
      isWhileStmt(stmt) ||
      isOnRisingEdgeStmt(stmt) ||
      isOnFallingEdgeStmt(stmt)
    ) {
      this.validateScopeBlockVariables(stmt.stmts, outerNames, accept);
    } else if (isForStmt(stmt)) {
      if (stmt.loopVar) addVariable(stmt.loopVar);
      this.validateScopeBlockVariables(stmt.stmts, outerNames, accept);
    } else if (isSwitchStmt(stmt)) {
      this.validateSwitchStatementScope(stmt, outerNames, accept);
    }
  }

  /**
   * Validates variable scopes in if/else if/else statements.
   *
   * @param stmt The if statement to validate
   * @param outerNames Set of visible variable names from outer scopes
   * @param accept The validation acceptor for reporting errors
   */
  private static validateIfStatementScope(
    stmt: any,
    outerNames: Set<string>,
    accept: ValidationAcceptor
  ) {
    this.validateScopeBlockVariables(stmt.stmts, outerNames, accept);
    for (const elseIf of stmt.elseIfStmts) {
      this.validateScopeBlockVariables(elseIf.stmts, outerNames, accept);
    }
    if (stmt.elseStmt) {
      this.validateScopeBlockVariables(stmt.elseStmt.stmts, outerNames, accept);
    }
  }

  /**
   * Validates variable scopes in switch statement cases.
   *
   * @param stmt The switch statement to validate
   * @param outerNames Set of visible variable names from outer scopes
   * @param accept The validation acceptor for reporting errors
   */
  private static validateSwitchStatementScope(
    stmt: any,
    outerNames: Set<string>,
    accept: ValidationAcceptor
  ) {
    for (const caseStmt of stmt.cases) {
      this.validateScopeBlockVariables(caseStmt.stmts, outerNames, accept);
    }
    if (stmt.default) {
      this.validateScopeBlockVariables(stmt.default.stmts, outerNames, accept);
    }
  }

  /**
   * Validates that all variable names within a function block are unique.
   * This includes inputs, outputs, local variables, and variables declared within logic statements.
   *
   * @param fb - The function block declaration to validate.
   * @param accept - A callback function to report validation issues.
   */
  static checkUniqueVarNamesInFunctionBlock(
    fb: FunctionBlockDecl,
    accept: ValidationAcceptor
  ) {
    const allVars: VarDecl[] = [
      ...getInputs(fb),
      ...getOutputs(fb),
      ...getLocals(fb),
    ];

    // Also check variables in the logic block
    for (const stmt of getLogic(fb)?.stmts ?? []) {
      if (isVarDecl(stmt)) {
        allVars.push(stmt);
      }
    }

    this.checkForDuplicateVarNames(
      allVars,
      (varName) =>
        `Duplicate variable name '${varName}' in function block '${fb.name}'.`,
      accept
    );
  }

  /**
   * Checks for duplicate variable names within a given control unit.
   *
   * @param unit - The control unit to validate.
   * @param accept - Function to report validation issues.
   */
  static checkUniqueVarNamesInUnit(
    unit: ControlUnit,
    accept: ValidationAcceptor
  ) {
    const allVars = unit.stmts.filter(isVarDecl);

    this.checkForDuplicateVarNames(
      allVars,
      (varName) =>
        `Duplicate local var name '${varName}' in unit '${unit.name}'.`,
      accept
    );
  }

  /**
   * Checks for duplicate variable names in a collection and reports errors.
   *
   * @param variables The collection of variables to check
   * @param errorMessageFn Function to generate error message based on variable name
   * @param accept The validation acceptor for reporting errors
   */
  private static checkForDuplicateVarNames(
    variables: VarDecl[],
    errorMessageFn: (varName: string) => string,
    accept: ValidationAcceptor
  ) {
    const seen = new Set<string>();

    for (const varDecl of variables) {
      if (seen.has(varDecl.name)) {
        accept("error", errorMessageFn(varDecl.name), {
          node: varDecl,
          property: "name",
        });
      } else {
        seen.add(varDecl.name);
      }
    }
  }

  /**
   * Checks for duplicate input mappings in a function block use statement.
   *
   * @param useStmt - The use statement to validate.
   * @param fb - The referenced function block.
   * @param accept - Function to report validation issues.
   */
  static checkDuplicateInputMappings(
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

  /**
   * Checks for duplicate output mappings in a function block use statement.
   *
   * @param useStmt - The use statement to validate.
   * @param fb - The referenced function block.
   * @param output - The output mapping to check.
   * @param accept - Function to report validation issues.
   */
  static checkDuplicateOutputMappings(
    useStmt: UseStmt,
    fb: FunctionBlockDecl,
    output: UseOutput,
    accept: ValidationAcceptor
  ) {
    const seen = new Set<string>();

    for (const map of output.mappingOutputs) {
      const fbOutputVar = map.fbOutputVar?.ref;

      if (!fbOutputVar) continue;

      if (seen.has(fbOutputVar.name)) {
        accept(
          "error",
          `Duplicate output mapping to variable '${fbOutputVar.name}' in use of '${fb.name}'.`,
          { node: map, property: "fbOutputVar" }
        );
      }
      seen.add(fbOutputVar.name);
    }
  }

  /**
   * Checks for duplicate declarations of global elements like enums, structs,
   * function blocks, control units, and global variables.
   *
   * @param model - The control model to validate.
   * @param accept - Function to report validation issues.
   */
  static checkUniqueGlobalDeclarations(
    model: ControlModel,
    accept: ValidationAcceptor
  ) {
    const enumNames = new Set<string>();
    const structNames = new Set<string>();
    const fbNames = new Set<string>();
    const unitNames = new Set<string>();
    const globalVarNames = new Set<string>();

    for (const item of model.controlBlock?.items ?? []) {
      this.checkDuplicateItem(
        item,
        structNames,
        isStructDecl,
        "struct",
        accept
      );
      this.checkDuplicateItem(item, enumNames, isEnumDecl, "enum", accept);
      this.checkDuplicateItem(
        item,
        fbNames,
        isFunctionBlockDecl,
        "function block",
        accept
      );
      this.checkDuplicateItem(
        item,
        unitNames,
        isControlUnit,
        "control unit",
        accept
      );
      this.checkDuplicateItem(
        item,
        globalVarNames,
        isVarDecl,
        "global variable",
        accept
      );
    }
  }

  /**
   * Helper method to check for duplicate items of a specific type.
   *
   * @param item The item to check
   * @param nameSet Set of already seen names
   * @param typeCheckFn Function to check if the item is of the right type
   * @param itemType String describing the type of item for error messages
   * @param accept The validation acceptor for reporting errors
   */
  private static checkDuplicateItem(
    item: any,
    nameSet: Set<string>,
    typeCheckFn: (item: any) => boolean,
    itemType: string,
    accept: ValidationAcceptor
  ) {
    if (typeCheckFn(item)) {
      if (nameSet.has(item.name)) {
        accept("error", `Duplicate ${itemType} '${item.name}'.`, {
          node: item,
          property: "name",
        });
      } else {
        nameSet.add(item.name);
      }
    }
  }
}
