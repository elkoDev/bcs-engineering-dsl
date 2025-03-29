import { AstNode } from "langium";
import {
  AbstractSemanticTokenProvider,
  SemanticTokenAcceptor,
} from "langium/lsp";
import { BCSHardwareLangServices } from "./bcs-hardware-lang-module.js";
import { isActuator, isSensor } from "./generated/ast.js";
import { SemanticTokenTypes } from "vscode-languageserver";

export class BCSHardwareLangSemanticTokenProvider extends AbstractSemanticTokenProvider {
  constructor(services: BCSHardwareLangServices) {
    super(services);
  }

  protected override highlightElement(
    node: AstNode,
    acceptor: SemanticTokenAcceptor
  ): void {
    if (isSensor(node) || isActuator(node)) {
      acceptor({
        node,
        property: "type",
        type: SemanticTokenTypes.type,
      });
      acceptor({
        node,
        property: "ioType",
        type: SemanticTokenTypes.type,
      });
      acceptor({
        node,
        property: "dataType",
        type: SemanticTokenTypes.type,
      });
    }
  }
}
