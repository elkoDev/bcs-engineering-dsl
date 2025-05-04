import type { Module } from "langium";
import { LangiumServices, PartialLangiumServices } from "langium/lsp";
import { BCSHardwareLangValidator } from "./bcs-hardware-lang-validator.js";
import { BCSHardwareLangSemanticTokenProvider } from "./bcs-hardware-lang-semantic-token-provider.js";

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
  validation: {
    BCSHardwareLangValidator: () => new BCSHardwareLangValidator(),
  },
  lsp: {
    SemanticTokenProvider: (services: BCSHardwareLangServices) =>
      new BCSHardwareLangSemanticTokenProvider(services),
  },
};
