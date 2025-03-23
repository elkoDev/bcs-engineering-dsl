import { ValidationChecks } from "langium";
import { BCSControlLangServices } from "./bcs-control-lang-module.js";
import { BCSEngineeringDSLAstType } from "./generated/ast.js";

export function registerBCSControlValidationChecks(
  services: BCSControlLangServices
) {
  const registry = services.validation.ValidationRegistry;
  const validator = services.validation.BCSControlLangValidator;
  const checks: ValidationChecks<BCSEngineeringDSLAstType> = {};
  registry.register(checks, validator);
}

export class BCSControlLangValidator {
  //private readonly services: BCSControlLangServices;

  constructor(services: BCSControlLangServices) {
    //this.services = services;
  }
}
