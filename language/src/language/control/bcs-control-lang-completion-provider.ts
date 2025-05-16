import { CompletionItemKind } from "vscode-languageserver-types";
import {
  DefaultCompletionProvider,
  CompletionContext,
  CompletionAcceptor,
  NextFeature,
} from "langium/lsp";
import type { BCSControlLangServices } from "./bcs-control-lang-module.js";
import { MaybePromise } from "langium";
import { isRef, isDatapoint, isEnumDecl } from "../generated/ast.js";

export class BCSControlLangCompletionProvider extends DefaultCompletionProvider {
  constructor(services: BCSControlLangServices) {
    super(services);
  }

  protected override completionFor(
    context: CompletionContext,
    next: NextFeature,
    acceptor: CompletionAcceptor
  ): MaybePromise<void> {
    const node = context.node;

    if (next.property === "property" && isRef(node)) {
      const namedElement = node.ref.ref;

      if (isDatapoint(namedElement)) {
        for (const channel of namedElement.channels) {
          acceptor(context, {
            label: channel.name,
            kind: CompletionItemKind.Field,
            documentation: `${channel.$container.portgroup.ref?.ioType} channel of type ${channel.dataType}`,
          });
        }
        return;
      }

      if (isEnumDecl(namedElement)) {
        for (const member of namedElement.members) {
          acceptor(context, {
            label: member.name,
            kind: CompletionItemKind.EnumMember,
            documentation: "Enum member of type " + namedElement.name,
          });
        }
        return;
      }
    }

    super.completionFor(context, next, acceptor);
  }
}
