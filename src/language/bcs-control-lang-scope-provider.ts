import { AstUtils, DefaultScopeProvider, ReferenceInfo, Scope } from "langium";
import { BCSControlLangServices } from "./bcs-control-lang-module.js";
import {
  Actuator,
  EnumDecl,
  isControlModel,
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

    if (isRef(container)) {
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

    return super.getScope(context);
  }
}
