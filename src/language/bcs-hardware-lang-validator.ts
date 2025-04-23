import { ValidationAcceptor, ValidationChecks } from "langium";
import { BCSEngineeringDSLAstType, Controller } from "./generated/ast.js";
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
}
