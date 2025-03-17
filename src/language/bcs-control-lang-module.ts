import type { Module } from "langium";
import { LangiumServices, PartialLangiumServices } from "langium/lsp";
import { BCSControlLangValidator } from "./bcs-control-lang-validator.js";

export type BCSControlAddedServices = {
  validation: {
    BCSControlLangValidator: BCSControlLangValidator;
  };
};

export type BCSControlLangServices = LangiumServices & BCSControlAddedServices;

export const BCSControlLangModule: Module<
  BCSControlLangServices,
  PartialLangiumServices & BCSControlAddedServices
> = {
  validation: {
    BCSControlLangValidator: (services: BCSControlLangServices) =>
      new BCSControlLangValidator(services),
  },
};
