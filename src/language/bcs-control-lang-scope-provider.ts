import { AstUtils, DefaultScopeProvider, ReferenceInfo, Scope } from "langium";
import { BCSControlLangServices } from "./bcs-control-lang-module.js";
import {
  Actuator,
  EnumDecl,
  isControlModel,
  isEnumDecl,
  isEnumMemberLiteral,
  isRef,
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
      const controlModel = AstUtils.getContainerOfType(
        context.container,
        isControlModel
      )!;
      const controller = controlModel?.controller.ref;
      const actuators =
        controller?.components.filter((c) => c.$type === Actuator) ?? [];
      const sensors =
        controller?.components.filter((c) => c.$type === Sensor) ?? [];
      const varDecls = controlModel.items.filter((i) => i.$type === VarDecl);
      const enumDecls = controlModel.items.filter((i) => i.$type === EnumDecl);

      const combinedComponents = [
        ...actuators,
        ...sensors,
        ...varDecls,
        ...enumDecls,
      ];
      return this.createScopeForNodes(combinedComponents);
    }
    if (isRef(container) && context.property === "property") {
      const enumDecl = container.ref?.ref;
      if (enumDecl && isEnumDecl(enumDecl)) {
        return this.createScopeForNodes(enumDecl.members);
      }
    }
    if (isEnumMemberLiteral(container) && context.property === "member") {
      const enumDecl = container.value?.ref; // already resolved EnumDecl
      if (enumDecl) {
        return this.createScopeForNodes(enumDecl.members);
      }
    }

    return super.getScope(context);
  }
}
