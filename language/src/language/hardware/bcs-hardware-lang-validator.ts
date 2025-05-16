import { ValidationAcceptor, ValidationChecks } from "langium";
import { BCSHardwareLangServices } from "./bcs-hardware-lang-module.js";
import {
  BCSEngineeringDSLAstType,
  Channel,
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
    Datapoint: [validator.checkDatapointChannelIndicesAndDuplicates],
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

  checkDatapointChannelIndicesAndDuplicates(
    datapoint: Datapoint,
    accept: ValidationAcceptor
  ): void {
    const portgroup = datapoint.portgroup?.ref;
    if (!portgroup) {
      accept(
        "error",
        `Datapoint '${datapoint.name}' must be assigned to a portgroup.`,
        {
          node: datapoint,
          property: "portgroup",
        }
      );
      return;
    }

    const maxIndex = portgroup.channels - 1;
    const indexMap = new Map<number, Channel[]>();

    for (const channel of datapoint.channels) {
      const index = channel.index;

      // Check index range
      if (index < 0 || index > maxIndex) {
        accept(
          "error",
          `Channel '${channel.name}' index ${index} is out of range (0 to ${maxIndex}) for portgroup '${portgroup.name}'.`,
          { node: channel, property: "index" }
        );
      }

      const existingAtIndex = indexMap.get(index) ?? [];
      for (const existing of existingAtIndex) {
        if (!channel.bitRange || !existing.bitRange) {
          // At least one of them has no bitRange -> full overlap
          accept(
            "error",
            `Duplicate channel index '${index}' used in '${datapoint.name}' (also used by '${existing.name}'), without distinct bit ranges.`,
            { node: channel, property: "index" }
          );
          break;
        }

        // Check if bit ranges overlap
        const aStart = channel.bitRange.start;
        const aEnd = channel.bitRange.end ?? channel.bitRange.start;
        const bStart = existing.bitRange.start;
        const bEnd = existing.bitRange.end ?? existing.bitRange.start;

        if (aStart <= bEnd && bStart <= aEnd) {
          accept(
            "error",
            `Bit range overlap at index ${index}: '${channel.name}' [${aStart}..${aEnd}] and '${existing.name}' [${bStart}..${bEnd}].`,
            { node: channel, property: "bitRange" }
          );
          break;
        }
      }

      indexMap.set(index, [...existingAtIndex, channel]);
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
