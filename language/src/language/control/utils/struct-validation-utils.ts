import { AstUtils, ValidationAcceptor } from "langium";
import {
  VarDecl,
  AssignmentStmt,
  Primary,
  StructDecl,
  StructLiteral,
  isVarDecl,
  isAssignmentStmt,
  isPrimary,
  isStructLiteral,
  isStructDecl,
  isControlModel,
  isArrayLiteral,
} from "../../generated/ast.js";

/**
 * Utility class for validating struct-related operations in the BCS control language.
 * Contains methods for validating struct literals, assignments, and field consistency.
 */
export class StructValidationUtils {
  /**
   * Validates struct literal assignment by checking field consistency and types
   */
  static validateStructLiteralAssignment(
    node: VarDecl | AssignmentStmt | Primary,
    accept: ValidationAcceptor,
    forceStructName?: string
  ): void {
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

  /**
   * Extracts struct information from different node types
   */
  static extractStructInfo(
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

  /**
   * Finds the struct declaration in the control model
   */
  static findStructDeclaration(
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

  /**
   * Validates struct fields for completeness and correctness
   */
  static validateStructFields(
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

  /**
   * Checks for duplicate fields in struct literal
   */
  static checkDuplicateFields(
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

  /**
   * Checks for unexpected fields in struct literal
   */
  static checkUnexpectedFields(
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

  /**
   * Checks for missing fields in struct literal
   */
  static checkMissingFields(
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

  /**
   * Determines if we're dealing with a struct array assignment that needs special handling
   */
  static isStructArrayAssignment(
    declaredType: string,
    initType: string
  ): boolean {
    return (
      initType.startsWith("ARRAY<STRUCT:") &&
      declaredType.startsWith("ARRAY<STRUCT:")
    );
  }

  /**
   * Validates struct array assignment by checking each element against the expected struct type
   */
  static validateStructArrayAssignment(
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
}
