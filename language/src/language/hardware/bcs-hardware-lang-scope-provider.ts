import { AstUtils, DefaultScopeProvider, ReferenceInfo, Scope } from "langium";
import { BCSHardwareLangServices } from "./bcs-hardware-lang-module.js";
import { isHardwareModel, isPortGroup } from "../generated/ast.js";
import { getBuses } from "./utils/hardware-definition-utils.js";

export class BCSHardwareLangScopeProvider extends DefaultScopeProvider {
  constructor(services: BCSHardwareLangServices) {
    super(services);
  }

  override getScope(context: ReferenceInfo): Scope {
    const container = context.container;

    if (isPortGroup(container) && context.property === "module") {
      const hardwareModel = AstUtils.getContainerOfType(
        container,
        isHardwareModel
      );
      if (!hardwareModel) {
        return super.getScope(context);
      }

      const bus = getBuses(hardwareModel)[0];
      if (!bus) {
        return super.getScope(context);
      }
      const modules = bus.boxes.flatMap((box) => {
        return box.modules;
      });
      return this.createScopeForNodes(modules);
    }

    return super.getScope(context);
  }
}
