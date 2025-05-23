import { AstNode } from "langium";
import { AbstractFormatter } from "langium/lsp";

export class BCSControlLangFormatter extends AbstractFormatter {
  protected override format(node: AstNode): void {}
}
