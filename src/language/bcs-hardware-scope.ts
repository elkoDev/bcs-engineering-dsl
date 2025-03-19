import { DefaultScopeProvider, ReferenceInfo, Scope } from "langium";
import { isCommand } from "./generated/ast.js";
import { BCSHardwareLangServices } from "./bcs-hardware-lang-module.js";

export class BCSHardwareScopeProvider extends DefaultScopeProvider {
  constructor(services: BCSHardwareLangServices) {
    super(services);
  }

  override getScope(context: ReferenceInfo): Scope {
    const container = context.container;
    if (isCommand(container) && context.property === "actuator") {
      const command = container.$container;
      const controller = command.$container.$container.plc.ref;
      const actuators =
        controller?.components.filter((c) => c.$type === "Actuator") ?? [];
      return this.createScopeForNodes(actuators);
    }

    return super.getScope(context);
  }
}
