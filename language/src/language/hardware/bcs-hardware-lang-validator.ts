import { ValidationAcceptor, ValidationChecks } from "langium";
import { BCSHardwareLangServices } from "./bcs-hardware-lang-module.js";
import {
  BCSEngineeringDSLAstType,
  Controller,
  Datapoint,
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
}
