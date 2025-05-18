import type { Module } from "langium";
import { LangiumServices, PartialLangiumServices } from "langium/lsp";
import { BCSHardwareLangValidator } from "./bcs-hardware-lang-validator.js";
import { BCSHardwareLangSemanticTokenProvider } from "./bcs-hardware-lang-semantic-token-provider.js";
import { BCSHardwareLangScopeProvider } from "./bcs-hardware-lang-scope-provider.js";

export type BCSHardwareAddedServices = {
  validation: {
    BCSHardwareLangValidator: BCSHardwareLangValidator;
  };
};

export type BCSHardwareLangServices = LangiumServices &
  BCSHardwareAddedServices;

export const BCSHardwareLangModule: Module<
  BCSHardwareLangServices,
  PartialLangiumServices & BCSHardwareAddedServices
> = {
  references: {
    ScopeProvider: (services: BCSHardwareLangServices) =>
      new BCSHardwareLangScopeProvider(services),
  },
  validation: {
    BCSHardwareLangValidator: () => new BCSHardwareLangValidator(),
  },
  lsp: {
    SemanticTokenProvider: (services: BCSHardwareLangServices) =>
      new BCSHardwareLangSemanticTokenProvider(services),
  },
};
