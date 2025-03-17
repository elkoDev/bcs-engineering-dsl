import { ValidationAcceptor, ValidationChecks } from "langium";
import { BCSEngineeringDSLAstType, Controller } from "./generated/ast.js";
import { BCSHardwareLangServices } from "./bcs-hardware-lang-module.js";

export function registerBCSHardwareValidationChecks(
  services: BCSHardwareLangServices
) {
  const registry = services.validation.ValidationRegistry;
  const validator = services.validation.BCSHardwareLangValidator;
  const checks: ValidationChecks<BCSEngineeringDSLAstType> = {
    Controller: [validator.checkControllerHasName],
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
}
