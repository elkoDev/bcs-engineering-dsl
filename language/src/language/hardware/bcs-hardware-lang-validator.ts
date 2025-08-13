import { ValidationAcceptor, ValidationChecks } from "langium";
import { BCSHardwareLangServices } from "./bcs-hardware-lang-module.js";
import {
  BCSEngineeringDSLAstType,
  Controller,
  Datapoint,
  isDatapoint,
  Module,
  PortGroup,
} from "../generated/ast.js";

export function registerBCSHardwareValidationChecks(
  services: BCSHardwareLangServices
) {
  const registry = services.validation.ValidationRegistry;
  const validator = services.validation.BCSHardwareLangValidator;
  const checks: ValidationChecks<BCSEngineeringDSLAstType> = {
    Controller: [
      validator.checkControllerHasName,
      validator.checkUniqueComponentNames,
      validator.checkModuleScopedLinkUniqueness,
    ],
    PortGroup: [validator.checkPortgroupChannelCount],
    Datapoint: [validator.checkDatapointChannelsValid],
  };
  registry.register(checks, validator);
}

export class BCSHardwareLangValidator {
  checkControllerHasName(
    controller: Controller,
    accept: ValidationAcceptor
  ): void {
    if (controller.name.length < 3) {
      accept("warning", `Controller name must be at least 3 characters long`, {
        node: controller,
        property: "name",
      });
    }
  }

  checkUniqueComponentNames(
    controller: Controller,
    accept: ValidationAcceptor
  ) {
    const seen = new Set<string>();
    for (const comp of controller.components) {
      if (seen.has(comp.name)) {
        accept(
          "error",
          `Duplicate component name '${comp.name}' in this controller.`,
          { node: comp, property: "name" }
        );
      } else {
        seen.add(comp.name);
      }
    }
  }

  checkDatapointChannelsValid(
    datapoint: Datapoint,
    accept: ValidationAcceptor
  ): void {
    const seenLinks = new Set<string>();
    for (const channel of datapoint.channels) {
      // Check name exists
      if (!channel.name || channel.name.length < 1) {
        accept("error", `Channel must have a name.`, {
          node: channel,
          property: "name",
        });
      }

      // Check link exists
      if (!channel.link || channel.link.length < 1) {
        accept(
          "error",
          `Channel '${channel.name}' must define a link to hardware IO.`,
          {
            node: channel,
            property: "link",
          }
        );
      } else if (seenLinks.has(channel.link)) {
        // Check uniqueness of link
        accept(
          "error",
          `Duplicate link '${channel.link}' in datapoint '${datapoint.name}'.`,
          {
            node: channel,
            property: "link",
          }
        );
      } else {
        seenLinks.add(channel.link);
      }
    }
  }

  checkPortgroupChannelCount(
    portGroup: PortGroup,
    accept: ValidationAcceptor
  ): void {
    if (portGroup.channels <= 0) {
      accept(
        "error",
        `Portgroup '${portGroup.name}' must define at least one channel.`,
        { node: portGroup, property: "channels" }
      );
    }
  }

  /**
   * Ensures that no two channels (possibly in different datapoints/portgroups)
   * map to the same physical module link. Multiple portgroups may reference
   * the same Module, but links on that Module must be globally unique.
   */
  checkModuleScopedLinkUniqueness(
    controller: Controller,
    accept: ValidationAcceptor
  ): void {
    const moduleLinksRegistry = new ModuleLinksRegistry();

    for (const datapoint of this.getDatapoints(controller)) {
      const module = this.getModuleFromDatapoint(datapoint);
      if (!module) continue;

      this.validateDatapointChannelLinks(
        datapoint,
        module,
        moduleLinksRegistry,
        accept
      );
    }
  }

  private getDatapoints(controller: Controller): Datapoint[] {
    return controller.components.filter(isDatapoint);
  }

  private getModuleFromDatapoint(datapoint: Datapoint): Module | null {
    return datapoint.portgroup?.ref?.module?.ref ?? null;
  }

  private validateDatapointChannelLinks(
    datapoint: Datapoint,
    module: Module,
    registry: ModuleLinksRegistry,
    accept: ValidationAcceptor
  ): void {
    for (const channel of datapoint.channels ?? []) {
      const link = channel.link?.trim();
      if (!link) continue; // empty links handled by per-datapoint check

      const existingOwner = registry.getLinkOwner(module, link);
      if (!existingOwner) {
        registry.registerLink(module, link, datapoint, channel.name);
        continue;
      }

      // Report only the later occurrence to avoid double-reporting
      accept(
        "error",
        `Link ${link} on module '${module.name}' is already used by '${existingOwner.datapoint.name}.${existingOwner.channelName}'.`,
        { node: channel, property: "link" }
      );
    }
  }
}

interface LinkOwner {
  datapoint: Datapoint;
  channelName: string;
}

class ModuleLinksRegistry {
  private readonly linksByModule = new Map<string, Map<string, LinkOwner>>();

  getLinkOwner(module: Module, link: string): LinkOwner | undefined {
    const moduleKey = this.getModuleKey(module);
    return this.linksByModule.get(moduleKey)?.get(link);
  }

  registerLink(
    module: Module,
    link: string,
    datapoint: Datapoint,
    channelName: string
  ): void {
    const moduleKey = this.getModuleKey(module);
    const moduleLinks = this.getOrCreateModuleLinks(moduleKey);
    moduleLinks.set(link, { datapoint, channelName });
  }

  private getModuleKey(module: Module): string {
    const boxName = (module.$container as any)?.name ?? "";
    return `${boxName}::${module.name}`;
  }

  private getOrCreateModuleLinks(moduleKey: string): Map<string, LinkOwner> {
    if (!this.linksByModule.has(moduleKey)) {
      this.linksByModule.set(moduleKey, new Map());
    }
    return this.linksByModule.get(moduleKey)!;
  }
}
