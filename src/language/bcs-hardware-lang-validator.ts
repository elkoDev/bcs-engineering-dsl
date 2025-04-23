import { ValidationAcceptor, ValidationChecks } from "langium";
import {
  BCSEngineeringDSLAstType,
  Channel,
  Controller,
  Datapoint,
  PortGroup,
} from "./generated/ast.js";
import { BCSHardwareLangServices } from "./bcs-hardware-lang-module.js";

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
  /**
   * Validates that the given controller has a name with a minimum length of 3 characters.
   * If the name is shorter than 3 characters, a warning is issued through the provided
   * validation acceptor.
   *
   * @param controller - The controller object to validate.
   * @param accept - The validation acceptor used to report warnings or errors.
   */
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

  /**
   * Validates that all components within a given controller have unique names.
   * If duplicate component names are found, an error is reported using the provided `ValidationAcceptor`.
   *
   * @param controller - The controller object containing the components to validate.
   * @param accept - A function used to report validation issues. It accepts the severity,
   *                 a message, and additional context about the validation issue.
   */
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

  /**
   * Validates the indices of datapoint channels within a controller.
   * It checks if the indices are within the valid range and if there are any duplicate indices.
   * If any issues are found, they are reported using the provided `ValidationAcceptor`.
   *
   * @param controller - The controller object containing the components to validate.
   * @param accept - A function used to report validation issues. It accepts the severity,
   *                 a message, and additional context about the validation issue.
   */
  checkDatapointChannelIndicesAndDuplicates(
    datapoint: Datapoint,
    accept: ValidationAcceptor
  ): void {
    const portgroup = datapoint.portgroup?.ref;
    if (!portgroup) {
      accept(
        "error",
        `Datapoint '${datapoint.name}' must be assigned to a portgroup.`,
        { node: datapoint, property: "portgroup" }
      );
      return;
    }

    const maxIndex = portgroup.channels - 1;
    const usedIndices = new Map<number, Channel>();

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

      // Check for duplicate index
      const existing = usedIndices.get(index);
      if (existing) {
        accept(
          "error",
          `Duplicate channel index '${index}' used in '${datapoint.name}' (also used by '${existing.name}').`,
          { node: channel, property: "index" }
        );
      } else {
        usedIndices.set(index, channel);
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
