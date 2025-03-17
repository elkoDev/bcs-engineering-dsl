import { ValidationAcceptor, ValidationChecks } from "langium";
import { BCSControlLangServices } from "./bcs-control-lang-module.js";
import {
  BCSEngineeringDSLAstType,
  LogicBlock,
  isHardwareModel,
} from "./generated/ast.js";

export function registerBCSControlValidationChecks(
  services: BCSControlLangServices
) {
  const registry = services.validation.ValidationRegistry;
  const validator = services.validation.BCSControlLangValidator;
  const checks: ValidationChecks<BCSEngineeringDSLAstType> = {
    LogicBlock: [validator.checkRequirementNameContainsANumber],
  };
  registry.register(checks, validator);
}

export class BCSControlLangValidator {
  private readonly services: BCSControlLangServices;

  constructor(services: BCSControlLangServices) {
    this.services = services;
  }

  checkRequirementNameContainsANumber(
    logicBlock: LogicBlock,
    accept: ValidationAcceptor
  ): void {
    if (logicBlock.name.length < 3) {
      accept(
        "warning",
        `Logic block name ${logicBlock.name} should be at least 3 characters long.`,
        { node: logicBlock, property: "name" }
      );
    }
  }

  checkLogicBlockIsCoveredByAController(
    logicBlock: LogicBlock,
    accept: ValidationAcceptor
  ): void {
    let ok = false;
    this.services.shared.workspace.LangiumDocuments.all
      .map((doc) => doc.parseResult?.value)
      .filter(isHardwareModel)
      .forEach((hardwareModel) => {
        hardwareModel.controllers.forEach((controller) => {
          if (controller.name === logicBlock.plc.ref?.name) {
            ok = true;
          }
        });
      });
    if (!ok) {
      accept("warning", `Hardware block ${logicBlock.name} does not exist.`, {
        node: logicBlock,
      });
    }
  }
}
