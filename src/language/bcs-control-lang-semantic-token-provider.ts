import { AstNode } from "langium";
import {
  AbstractSemanticTokenProvider,
  SemanticTokenAcceptor,
} from "langium/lsp";
import { BCSControlLangServices } from "./bcs-control-lang-module.js";
import { isEnumDecl, isTypeRef } from "./generated/ast.js";
import { SemanticTokenTypes } from "vscode-languageserver";

export class BCSControlLangSemanticTokenProvider extends AbstractSemanticTokenProvider {
  constructor(services: BCSControlLangServices) {
    super(services);
  }

  protected override highlightElement(
    node: AstNode,
    acceptor: SemanticTokenAcceptor
  ): void {
    if (isTypeRef(node)) {
      acceptor({
        node,
        property: "type",
        type: SemanticTokenTypes.type,
      });
      acceptor({
        node,
        property: "ref",
        type: SemanticTokenTypes.type,
      });
    }
    if (isEnumDecl(node)) {
      acceptor({
        node,
        property: "name",
        type: SemanticTokenTypes.enum,
      });
      acceptor({
        node,
        property: "members",
        type: SemanticTokenTypes.enumMember,
      });
    }
  }
}
