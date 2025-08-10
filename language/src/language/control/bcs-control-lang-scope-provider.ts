import {
  AstNode,
  AstUtils,
  DefaultScopeProvider,
  EMPTY_SCOPE,
  ReferenceInfo,
  Scope,
} from "langium";
import { BCSControlLangServices } from "./bcs-control-lang-module.js";

import {
  getInputs,
  getLocals,
  getOutputs,
} from "./utils/function-block-utils.js";
import {
  isRef,
  isControlModel,
  Datapoint,
  isEnumDecl,
  isStructDecl,
  isFunctionBlockDecl,
  isVarDecl,
  isDatapoint,
  isEnumMemberLiteral,
  isInputMapping,
  isUseStmt,
  isMappingUseResult,
  VarDecl,
  isForStmt,
  isControlUnit,
} from "../generated/ast.js";

export class BCSControlLangScopeProvider extends DefaultScopeProvider {
  constructor(services: BCSControlLangServices) {
    super(services);
  }

  override getScope(context: ReferenceInfo): Scope {
    const container = context.container;

    if (isRef(container) && context.property === "ref") {
      const localVars = this.collectVars(container);
      const controlModel = AstUtils.getContainerOfType(
        container,
        isControlModel
      );
      const controller = controlModel?.controlBlock?.controller.ref;
      const datapoints =
        controller?.components.filter((c) => c.$type === Datapoint) ?? [];

      const enumDecls =
        controlModel?.controlBlock?.items.filter(isEnumDecl) ?? [];

      const externalEnumDecls = controlModel?.externTypeDecls.filter(isEnumDecl) ?? [];

      const scopeNodes: AstNode[] = [
        ...localVars,
        ...enumDecls,
        ...externalEnumDecls,
      ];

      const isInsideFunctionBlock =
        AstUtils.getContainerOfType(container, isFunctionBlockDecl) !==
        undefined;
      if (!isInsideFunctionBlock) {
        const globalVars =
          controlModel?.controlBlock?.items.filter(isVarDecl) ?? [];
        scopeNodes.push(...globalVars);
        scopeNodes.push(...datapoints);
      }

      return this.createScopeForNodes(scopeNodes);
    }

    // property = enum member reference or datapoint channel reference
    if (isRef(container) && context.property === "properties") {
      const namedElement = container.ref.ref;
      if (isVarDecl(namedElement)) {
        const typeRef = namedElement.typeRef;
        const structDecl = typeRef?.ref?.ref;

        if (structDecl && isStructDecl(structDecl)) {
          return this.createScopeForNodes(structDecl.fields);
        }
      }
      if (isEnumDecl(namedElement)) {
        const enumDecl = namedElement;
        return this.createScopeForNodes(enumDecl.members);
      }
      if (isDatapoint(namedElement)) {
        const datapoint = namedElement;
        return this.createScopeForNodes(datapoint.channels);
      }
    }

    // enum literal member completion
    if (isEnumMemberLiteral(container) && context.property === "member") {
      const enumDecl = container.enumDecl?.ref;
      if (enumDecl && isEnumDecl(enumDecl)) {
        return this.createScopeForNodes(enumDecl.members);
      }
    }

    if (isInputMapping(container)) {
      const useStmt = AstUtils.getContainerOfType(container, isUseStmt);
      if (!useStmt?.functionBlockRef?.ref) return EMPTY_SCOPE;

      const fb = useStmt.functionBlockRef.ref;
      const fbParams = getInputs(fb);

      return this.createScopeForNodes(fbParams);
    }

    if (isMappingUseResult(container) && context.property === "fbOutputVar") {
      const useStmt = AstUtils.getContainerOfType(container, isUseStmt);
      if (!useStmt?.functionBlockRef?.ref) return EMPTY_SCOPE;

      const fb = useStmt.functionBlockRef.ref;
      const fbParams = getOutputs(fb);

      return this.createScopeForNodes(fbParams);
    }

    return super.getScope(context);
  }

  private collectVars(container: AstNode): VarDecl[] {
    const vars: VarDecl[] = [];

    // Collect all enclosing for-loop variables (from innermost to outermost)
    let current: AstNode | undefined = container;
    while (current) {
      if (isForStmt(current) && current.loopVar) {
        vars.push(current.loopVar);
      }
      current = current.$container;
    }

    // Collect variables from the enclosing control unit (top-level vars)
    const unit = AstUtils.getContainerOfType(container, isControlUnit);
    if (unit) {
      for (const stmt of unit.stmts) {
        if (isVarDecl(stmt)) {
          vars.push(stmt);
        }
      }
    }

    // Collect variables from the enclosing function block (inputs, outputs, locals) if the container is inside the function block
    const fb = AstUtils.getContainerOfType(container, isFunctionBlockDecl);
    if (fb) {
      vars.push(...getInputs(fb), ...getOutputs(fb), ...getLocals(fb));
    }

    return vars;
  }
}
