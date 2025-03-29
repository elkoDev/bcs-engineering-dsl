import { AstNode } from "langium";
import {
  AbstractSemanticTokenProvider,
  SemanticTokenAcceptor,
} from "langium/lsp";
import { BCSControlLangServices } from "./bcs-control-lang-module.js";
import {
  isActuator,
  isArgument,
  isBinExpr,
  isEnumDecl,
  isEnumMemberLiteral,
  isFunctionBlockCallStmt,
  isPrimary,
  isRef,
  isSensor,
  isTypeRef,
  isVarDecl,
} from "./generated/ast.js";
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
    if (isRef(node)) {
      let namedElement = node.ref.ref;
      if (isVarDecl(namedElement)) {
        acceptor({
          node,
          property: "ref",
          type: SemanticTokenTypes.variable,
        });
      } else if (isEnumDecl(namedElement)) {
        acceptor({
          node,
          property: "ref",
          type: SemanticTokenTypes.enum,
        });
        acceptor({
          node,
          property: "property",
          type: SemanticTokenTypes.enumMember,
        });
      } else if (isActuator(namedElement) || isSensor(namedElement)) {
        acceptor({
          node,
          property: "ref",
          type: SemanticTokenTypes.struct,
        });
      }
    }
    if (isVarDecl(node)) {
      acceptor({
        node,
        property: "name",
        type: SemanticTokenTypes.variable,
      });
      acceptor({
        node,
        property: "type",
        type: SemanticTokenTypes.type,
      });
    }
    if (isFunctionBlockCallStmt(node)) {
      acceptor({
        node,
        property: "target",
        type: SemanticTokenTypes.function,
      });
    }
    if (isArgument(node)) {
      acceptor({
        node,
        property: "name",
        type: SemanticTokenTypes.property,
      });
    }
    if (isEnumMemberLiteral(node)) {
      acceptor({
        node,
        property: "value",
        type: SemanticTokenTypes.enum,
      });
      acceptor({
        node,
        property: "member",
        type: SemanticTokenTypes.enumMember,
      });
    }
    if (isPrimary(node)) {
      if (typeof node.val === "number") {
        acceptor({
          node,
          property: "val",
          type: SemanticTokenTypes.number,
        });
      }
      if (typeof node.val === "string") {
        acceptor({
          node,
          property: "val",
          type: SemanticTokenTypes.string,
        });
      }
      if (typeof node.val === "boolean") {
        acceptor({
          node,
          property: "val",
          type: SemanticTokenTypes.number,
        });
      }
      if (isBinExpr(node)) {
        acceptor({
          node,
          property: "op",
          type: SemanticTokenTypes.operator,
        });
      }
    }
  }
}
