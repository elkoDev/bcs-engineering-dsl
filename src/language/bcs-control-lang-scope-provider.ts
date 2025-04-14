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
  Actuator,
  isControlModel,
  isControlUnit,
  isEnumDecl,
  isEnumMemberLiteral,
  isForStmt,
  isFunctionBlockDecl,
  isInputMapping,
  isMappingUseResult,
  isRef,
  isUseStmt,
  isVarDecl,
  Sensor,
  VarDecl,
} from "./generated/ast.js";
import {
  getInputs,
  getLocals,
  getOutputs,
} from "./utils/function-block-utils.js";

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
      const controller = controlModel?.controller.ref;
      const actuators =
        controller?.components.filter((c) => c.$type === Actuator) ?? [];
      const sensors =
        controller?.components.filter((c) => c.$type === Sensor) ?? [];

      const enumDecls = controlModel?.items.filter(isEnumDecl) ?? [];

      const scopeNodes: AstNode[] = [
        ...localVars,
        ...actuators,
        ...sensors,
        ...enumDecls,
      ];

      const isInsideFunctionBlock =
        AstUtils.getContainerOfType(container, isFunctionBlockDecl) !==
        undefined;
      if (!isInsideFunctionBlock) {
        const globalVars = controlModel?.items.filter(isVarDecl) ?? [];
        scopeNodes.push(...globalVars);
      }

      return this.createScopeForNodes(scopeNodes);
    }

    // property = enum member reference
    if (isRef(container) && context.property === "property") {
      const enumDecl = container.ref?.ref;
      if (enumDecl && isEnumDecl(enumDecl)) {
        return this.createScopeForNodes(enumDecl.members);
      }
    }

    // enum literal member completion
    if (isEnumMemberLiteral(container) && context.property === "member") {
      const enumDecl = container.value?.ref;
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

    if (isMappingUseResult(container) && context.property === "outputVar") {
      const useStmt = AstUtils.getContainerOfType(container, isUseStmt);
      if (!useStmt?.functionBlockRef?.ref) return EMPTY_SCOPE;

      const fb = useStmt.functionBlockRef.ref;
      const fbParams = getInputs(fb);

      return this.createScopeForNodes(fbParams);
    }

    return super.getScope(context);
  }

  private collectVars(container: AstNode): VarDecl[] {
    const unit = AstUtils.getContainerOfType(container, isControlUnit);
    const fb = AstUtils.getContainerOfType(container, isFunctionBlockDecl);
    const vars: VarDecl[] = [];

    if (unit) {
      for (const stmt of unit.stmts) {
        if (isVarDecl(stmt)) {
          vars.push(stmt);
        }
        if (isForStmt(stmt)) {
          if (stmt.loopVar) {
            vars.push(stmt.loopVar);
          }
        }
      }
    }

    if (fb) {
      vars.push(...getInputs(fb), ...getOutputs(fb), ...getLocals(fb));
    }

    return vars;
  }
}
