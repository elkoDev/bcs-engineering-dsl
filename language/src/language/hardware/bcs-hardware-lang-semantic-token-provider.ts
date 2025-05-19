import { AstNode } from "langium";
import {
  AbstractSemanticTokenProvider,
  SemanticTokenAcceptor,
} from "langium/lsp";
import { BCSHardwareLangServices } from "./bcs-hardware-lang-module.js";

import { SemanticTokenTypes } from "vscode-languageserver";
import {
  isController,
  isDatapoint,
  isChannel,
  isPortGroup,
  isBitRange,
  isBus,
  isBox,
  isModule,
  isNetworkSettings,
} from "../generated/ast.js";

export class BCSHardwareLangSemanticTokenProvider extends AbstractSemanticTokenProvider {
  constructor(services: BCSHardwareLangServices) {
    super(services);
  }

  protected override highlightElement(
    node: AstNode,
    acceptor: SemanticTokenAcceptor
  ): void {
    if (isController(node)) {
      acceptor({
        node,
        property: "name",
        type: SemanticTokenTypes.class,
      });
      acceptor({
        node,
        property: "platform",
        type: SemanticTokenTypes.enumMember,
      });
    }
    if (isDatapoint(node)) {
      acceptor({
        node,
        property: "name",
        type: SemanticTokenTypes.decorator,
      });
      acceptor({
        node,
        property: "portgroup",
        type: SemanticTokenTypes.type,
      });
    }
    if (isChannel(node)) {
      acceptor({
        node,
        property: "name",
        type: SemanticTokenTypes.variable,
      });
      acceptor({
        node,
        property: "dataType",
        type: SemanticTokenTypes.type,
      });
      acceptor({
        node,
        property: "index",
        type: SemanticTokenTypes.number,
      });
    }
    if (isPortGroup(node)) {
      acceptor({
        node,
        property: "name",
        type: SemanticTokenTypes.class,
      });
      acceptor({
        node,
        property: "module",
        type: SemanticTokenTypes.type,
      });
      acceptor({
        node,
        property: "ioType",
        type: SemanticTokenTypes.enumMember,
      });
      acceptor({
        node,
        property: "channels",
        type: SemanticTokenTypes.number,
      });
    }
    if (isBitRange(node)) {
      acceptor({
        node,
        property: "start",
        type: SemanticTokenTypes.number,
      });
      acceptor({
        node,
        property: "end",
        type: SemanticTokenTypes.number,
      });
    }
    if (isBus(node)) {
      acceptor({
        node,
        property: "name",
        type: SemanticTokenTypes.class,
      });
      acceptor({
        node,
        property: "master",
        type: SemanticTokenTypes.string,
      });
      acceptor({
        node,
        property: "busType",
        type: SemanticTokenTypes.enumMember,
      });
    }
    if (isBox(node)) {
      acceptor({
        node,
        property: "name",
        type: SemanticTokenTypes.class,
      });
      acceptor({
        node,
        property: "productCode",
        type: SemanticTokenTypes.enumMember,
      });
      acceptor({
        node,
        property: "rev",
        type: SemanticTokenTypes.string,
      });
    }
    if (isModule(node)) {
      acceptor({
        node,
        property: "name",
        type: SemanticTokenTypes.class,
      });
      acceptor({
        node,
        property: "productCode",
        type: SemanticTokenTypes.enumMember,
      });
      acceptor({
        node,
        property: "rev",
        type: SemanticTokenTypes.string,
      });
      acceptor({
        node,
        property: "slot",
        type: SemanticTokenTypes.number,
      });
    }
    if (isNetworkSettings(node)) {
      acceptor({
        node,
        property: "ip",
        type: SemanticTokenTypes.string,
      });
      acceptor({
        node,
        property: "mask",
        type: SemanticTokenTypes.string,
      });
    }
  }
}
