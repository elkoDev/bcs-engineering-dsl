import type { Module } from "langium";
import { LangiumServices, PartialLangiumServices } from "langium/lsp";
import { BCSControlLangValidator } from "./bcs-control-lang-validator.js";
import { BCSControlLangSemanticTokenProvider } from "./bcs-control-lang-semantic-token-provider.js";
import { BCSControlLangScopeProvider } from "./bcs-control-lang-scope-provider.js";
import { BCSControlLangCompletionProvider } from "./bcs-control-lang-completion-provider.js";
import { BCSControlLangFormatter } from "./bcs-control-lang-formatter.js";

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
    BCSControlLangValidator: () => new BCSControlLangValidator(),
  },
  lsp: {
    SemanticTokenProvider: (services: BCSControlLangServices) =>
      new BCSControlLangSemanticTokenProvider(services),
    Formatter: () => new BCSControlLangFormatter(),
    CompletionProvider: (services: BCSControlLangServices) =>
      new BCSControlLangCompletionProvider(services),
  },
};
