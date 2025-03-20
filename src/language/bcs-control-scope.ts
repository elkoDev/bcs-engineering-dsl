import { DefaultScopeProvider, ReferenceInfo, Scope } from "langium";
import { Actuator, Condition, isCommand, isRef, Sensor } from "./generated/ast.js";
import { BCSControlLangServices } from "./bcs-control-lang-module.js";

export class BCSControlScopeProvider extends DefaultScopeProvider {
  constructor(services: BCSControlLangServices) {
    super(services);
  }

  override getScope(context: ReferenceInfo): Scope {
    const container = context.container;
    if (isCommand(container) && context.property === "actuator") {
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
    }

    return super.getScope(context);
  }
}
