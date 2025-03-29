import type { Module } from "langium";
import { LangiumServices, PartialLangiumServices } from "langium/lsp";
import { BCSControlLangValidator } from "./bcs-control-lang-validator.js";
import { BCSControlLangScopeProvider } from "./bcs-control-lang-scope.js";

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
  references: {
    ScopeProvider: (services: BCSControlLangServices) =>
      new BCSControlLangScopeProvider(services),
  },
  validation: {
    BCSControlLangValidator: (services: BCSControlLangServices) =>
      new BCSControlLangValidator(services),
  },
};
