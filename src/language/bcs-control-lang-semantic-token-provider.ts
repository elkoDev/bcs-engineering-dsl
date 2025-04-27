import { AstNode } from "langium";
import {
  AbstractSemanticTokenProvider,
  SemanticTokenAcceptor,
} from "langium/lsp";
import { BCSControlLangServices } from "./bcs-control-lang-module.js";
import {
  isBinExpr,
  isCaseLiteral,
  isControlBlock,
  isControlUnit,
  isDatapoint,
  isEnumDecl,
  isEnumMemberLiteral,
  isFunctionBlockDecl,
  isInputMapping,
  isMappingUseResult,
  isPrimary,
  isRampStmt,
  isRef,
  isSimpleUseResult,
  isStructDecl,
  isStructFieldDecl,
  isTypeRef,
  isUseStmt,
  isVarDecl,
  isWaitStmt,
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
    if (isControlBlock(node)) {
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
        const match = RegExp(/TOD#[0-9:]+/).exec(fullText);
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
          property: "properties",
          type: SemanticTokenTypes.enumMember,
        });
      } else if (isDatapoint(namedElement)) {
        acceptor({
          node,
          property: "ref",
          type: SemanticTokenTypes.struct,
        });
        acceptor({
          node,
          property: "properties",
          type: SemanticTokenTypes.variable,
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
        property: "typeRef",
        type: SemanticTokenTypes.type,
      });
    }
    if (isFunctionBlockDecl(node)) {
      acceptor({
        node,
        property: "name",
        type: SemanticTokenTypes.function,
      });
    }
    if (isStructDecl(node)) {
      acceptor({
        node,
        property: "name",
        type: SemanticTokenTypes.struct,
      });
    }
    if (isStructFieldDecl(node)) {
      acceptor({
        node,
        property: "name",
        type: SemanticTokenTypes.variable,
      });
      acceptor({
        node,
        property: "typeRef",
        type: SemanticTokenTypes.type,
      });
    }

    if (isUseStmt(node)) {
      acceptor({
        node,
        property: "functionBlockRef",
        type: SemanticTokenTypes.function,
      });
    }
    if (isMappingUseResult(node)) {
      acceptor({
        node,
        property: "outputVar",
        type: SemanticTokenTypes.comment,
      });
      acceptor({
        node,
        property: "fbOutput",
        type: SemanticTokenTypes.variable,
      });
    }
    if (isSimpleUseResult(node)) {
      acceptor({
        node,
        property: "outputVar",
        type: SemanticTokenTypes.variable,
      });
    }
    if (isInputMapping(node)) {
      acceptor({
        node,
        property: "inputVar",
        type: SemanticTokenTypes.comment,
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
    if (isCaseLiteral(node) && !isEnumMemberLiteral(node.val)) {
      acceptor({
        node,
        property: "val",
        type: SemanticTokenTypes.type,
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
      if (typeof node.val === "string") {
        if (node.val.startsWith("T#")) {
          this.formatTimeLiteral(node, acceptor);
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
    if (isWaitStmt(node)) {
      if (node.time && node.$cstNode) {
        const fullText = node.$cstNode.text;
        const match = RegExp(/T#\d+(ms|s|m|h|d)/).exec(fullText);
        if (match) {
          const matchIndex = fullText.indexOf(match[0]);
          const { line, character } = node.$cstNode.range.start;
          const startChar = character + matchIndex;
          this.formatTimeLiteralRaw(
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
    if (isRampStmt(node)) {
      if (node.dur && node.$cstNode) {
        const fullText = node.$cstNode.text;
        const match = RegExp(/T#\d+(ms|s|m|h|d)/).exec(fullText);
        if (match) {
          const matchIndex = fullText.indexOf(match[0]);
          const { line, character } = node.$cstNode.range.start;
          const startChar = character + matchIndex;
          this.formatTimeLiteralRaw(
            node,
            match[0],
            line,
            startChar,
            acceptor,
            "dur"
          );
        }
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

  formatTimeLiteral(node: Primary, acceptor: SemanticTokenAcceptor) {
    const nodeCst = node.$cstNode;
    if (!nodeCst) return;

    const text = nodeCst.text; // e.g. 'T#10s'
    const { line, character } = nodeCst.range.start;
    this.formatTimeLiteralRaw(node, text, line, character, acceptor, "val");
  }

  private formatTodLiteralRaw(
    node: AstNode,
    text: string,
    line: number,
    char: number,
    acceptor: SemanticTokenAcceptor,
    property: string
  ) {
    // Highlight `TOD`
    const rangePrefix = Range.create(
      Position.create(line, char),
      Position.create(line, char + 3)
    );
    acceptor({
      node,
      property,
      range: rangePrefix,
      type: SemanticTokenTypes.type,
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

  private formatTimeLiteralRaw(
    node: AstNode,
    text: string,
    line: number,
    char: number,
    acceptor: SemanticTokenAcceptor,
    property: string
  ) {
    // Highlight `T`
    const rangePrefix = Range.create(
      Position.create(line, char),
      Position.create(line, char + 1)
    );
    acceptor({
      node,
      property,
      range: rangePrefix,
      type: SemanticTokenTypes.type,
    });

    // Highlight `10s`
    const rangeTime = Range.create(
      Position.create(line, char + 2),
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
