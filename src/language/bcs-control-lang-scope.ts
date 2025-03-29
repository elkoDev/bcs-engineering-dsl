import { DefaultScopeProvider, ReferenceInfo, Scope } from "langium";
import { BCSControlLangServices } from "./bcs-control-lang-module.js";
import {
  Actuator,
  ControlModel,
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
      const controlModel = container.$cstNode?.root.astNode as ControlModel;
      const controller = controlModel?.controller.ref;
      const actuators =
        controller?.components.filter((c) => c.$type === Actuator) ?? [];
      const sensors =
        controller?.components.filter((c) => c.$type === Sensor) ?? [];

      const varDecls = controlModel.items.filter((i) => i.$type === VarDecl);

      // Combine actuators, sensors, and varDecls into a single array
      const combinedComponents = [...actuators, ...sensors, ...varDecls];

      return this.createScopeForNodes(combinedComponents);
    }

    return super.getScope(context);
  }

  // ----------------------------------------------------------------
  /*if (isCommand(container) && context.property === "actuator") {
      const command = container.$container;
      const controller = command.$container.$container.plc.ref;
      const actuators =
        controller?.components.filter((c) => c.$type === Actuator) ?? [];
      return this.createScopeForNodes(actuators);
    }
    if (isRef(container) && context.property === "sensor") {
      const ref = container.$container;
      const controller = (ref.$container as Condition).$container.$container.plc
        .ref;
      const sensors =
        controller?.components.filter((c) => c.$type === Sensor) ?? [];
      return this.createScopeForNodes(sensors);
    }*/
}
