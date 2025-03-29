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
  isControlModel,
  isControlUnit,
  isEnumDecl,
  isEnumMemberLiteral,
  isFunctionBlockCallStmt,
  isPrimary,
  isRef,
  isSensor,
  isTypeRef,
  isVarDecl,
  Primary,
} from "./generated/ast.js";
import { Position, Range, SemanticTokenTypes } from "vscode-languageserver";

export class BCSControlLangSemanticTokenProvider extends AbstractSemanticTokenProvider {
  constructor(services: BCSControlLangServices) {
    super(services);
  }

  protected override highlightElement(
    node: AstNode,
    acceptor: SemanticTokenAcceptor
  ): void {
    if (isControlModel(node)) {
      acceptor({
        node,
        property: "controller",
        type: SemanticTokenTypes.macro,
      });
    }
    if (isControlUnit(node)) {
      acceptor({
        node,
        property: "name",
        type: SemanticTokenTypes.decorator,
      });
      if (node.time && node.$cstNode) {
        const fullText = node.$cstNode.text;
        const match = fullText.match(/TOD#[0-9:]+/);
        if (match) {
          const matchIndex = fullText.indexOf(match[0]);
          const { line, character } = node.$cstNode.range.start;
          const startChar = character + matchIndex;
          this.formatTodLiteralRaw(
            node,
            match[0],
            line,
            startChar,
            acceptor,
            "time"
          );
        }
      }
    }
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
        if (node.val.startsWith("TOD#")) {
          this.formatTodLiteral(node, acceptor);
        }
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

  getOffsetRange(
    line: number,
    char: number,
    skip: number,
    length: number
  ): Range {
    return Range.create(
      Position.create(line, char + skip),
      Position.create(line, char + length)
    );
  }

  formatTodLiteral(node: Primary, acceptor: SemanticTokenAcceptor) {
    const nodeCst = node.$cstNode;
    if (!nodeCst) return;

    const text = nodeCst.text; // e.g. 'TOD#08:00:00'
    const { line, character } = nodeCst.range.start;
    this.formatTodLiteralRaw(node, text, line, character, acceptor, "val");
  }

  formatTodLiteralRaw(
    node: AstNode,
    text: string,
    line: number,
    char: number,
    acceptor: SemanticTokenAcceptor,
    property: string
  ) {
    // Highlight `TOD#`
    const rangePrefix = Range.create(
      Position.create(line, char),
      Position.create(line, char + 4)
    );
    acceptor({
      node,
      property,
      range: rangePrefix,
      type: SemanticTokenTypes.string,
    });

    // Highlight `08:00:00`
    const rangeTime = Range.create(
      Position.create(line, char + 4),
      Position.create(line, char + text.length)
    );
    acceptor({
      node,
      property,
      range: rangeTime,
      type: SemanticTokenTypes.string,
    });
  }
}
