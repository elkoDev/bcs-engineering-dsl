import {
  AstNode,
  AstUtils,
  DefaultScopeProvider,
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
  isFunctionBlockDecl,
  isRef,
  isVarDecl,
  Sensor,
  VarDecl,
} from "./generated/ast.js";

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
      }
    }

    if (fb) {
      vars.push(
        ...(fb.inputs ?? []),
        ...(fb.outputs ?? []),
        ...(fb.locals ?? [])
      );
    }

    return vars;
  }
}
