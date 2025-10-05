import { AstNode } from "langium";
import { AbstractFormatter, Formatting } from "langium/lsp";
import * as ast from "../generated/ast.js";

export class BCSControlLangFormatter extends AbstractFormatter {
  protected format(node: AstNode): void {
    this.formatStructuralElements(node) ||
      this.formatDeclarations(node) ||
      this.formatStatements(node) ||
      this.formatExpressions(node);
  }

  private formatStructuralElements(node: AstNode): boolean {
    if (ast.isControlModel(node)) {
      this.formatControlModel(node);
      return true;
    }
    if (ast.isControlBlock(node)) {
      this.formatControlBlock(node);
      return true;
    }
    if (ast.isControlUnit(node)) {
      this.formatControlUnit(node);
      return true;
    }
    return false;
  }
  private formatDeclarations(node: AstNode): boolean {
    if (ast.isEnumDecl(node)) {
      this.formatEnumDecl(node);
      return true;
    }
    if (ast.isStructDecl(node)) {
      this.formatStructDecl(node);
      return true;
    }
    if (ast.isVarDecl(node)) {
      this.formatVarDecl(node);
      return true;
    }
    if (ast.isFunctionBlockDecl(node)) {
      this.formatFunctionBlockDecl(node);
      return true;
    }
    if (ast.isFunctionBlockInputs(node)) {
      this.formatFunctionBlockInputs(node);
      return true;
    }
    if (ast.isFunctionBlockOutputs(node)) {
      this.formatFunctionBlockOutputs(node);
      return true;
    }
    if (ast.isFunctionBlockLocals(node)) {
      this.formatFunctionBlockLocals(node);
      return true;
    }
    if (ast.isFunctionBlockLogic(node)) {
      this.formatFunctionBlockLogic(node);
      return true;
    }
    return false;
  }
  private formatStatements(node: AstNode): boolean {
    if (ast.isAssignmentStmt(node)) {
      this.formatAssignmentStmt(node);
      return true;
    }
    if (ast.isIfStmt(node)) {
      this.formatIfStmt(node);
      return true;
    }
    if (ast.isElseIfStmt(node)) {
      this.formatElseIfStmt(node);
      return true;
    }
    if (ast.isElseStmt(node)) {
      this.formatElseStmt(node);
      return true;
    }
    if (ast.isWhileStmt(node)) {
      this.formatWhileStmt(node);
      return true;
    }
    if (ast.isForStmt(node)) {
      this.formatForStmt(node);
      return true;
    }
    if (ast.isSwitchStmt(node)) {
      this.formatSwitchStmt(node);
      return true;
    }
    if (ast.isCaseOption(node)) {
      this.formatCaseOption(node);
      return true;
    }
    if (ast.isDefaultOption(node)) {
      this.formatDefaultOption(node);
      return true;
    }
    if (ast.isAfterStmt(node)) {
      this.formatAfterStmt(node);
      return true;
    }
    if (ast.isOnRisingEdgeStmt(node) || ast.isOnFallingEdgeStmt(node)) {
      this.formatEdgeStmt(node);
      return true;
    }
    if (ast.isUseStmt(node)) {
      this.formatUseStmt(node);
      return true;
    }
    return false;
  }

  private formatExpressions(node: AstNode): boolean {
    if (ast.isBinExpr(node)) {
      this.formatBinExpr(node);
      return true;
    }
    if (ast.isArrayLiteral(node)) {
      this.formatArrayLiteral(node);
      return true;
    }
    if (ast.isStructLiteral(node)) {
      this.formatStructLiteral(node);
      return true;
    }
    return false;
  }

  private formatControlModel(node: ast.ControlModel): void {
    const formatter = this.getNodeFormatter(node);

    // Format import declarations
    for (const importDecl of node.importDecls) {
      formatter.node(importDecl).prepend(Formatting.noIndent());
    }

    // Format extern type declarations
    for (const externDecl of node.externTypeDecls) {
      formatter.node(externDecl).prepend(Formatting.noIndent());
    }

    // Format control block
    formatter.node(node.controlBlock).prepend(Formatting.noIndent());
  }

  private formatControlBlock(node: ast.ControlBlock): void {
    const formatter = this.getNodeFormatter(node);
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Add space around controller reference
    formatter.property("controller").surround(Formatting.oneSpace());

    // Format opening brace
    openBrace.prepend(Formatting.oneSpace());
    openBrace.append(Formatting.newLine());

    // Indent content inside braces
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());

    // Add spacing between items
    for (let i = 0; i < node.items.length - 1; i++) {
      formatter.node(node.items[i]).append(Formatting.newLine());
    }
  }

  private formatEnumDecl(node: ast.EnumDecl): void {
    const formatter = this.getNodeFormatter(node);
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Space around enum name
    formatter.property("name").surround(Formatting.oneSpace());

    // Format braces
    openBrace.prepend(Formatting.oneSpace());
    openBrace.append(Formatting.newLine());

    // Indent enum members
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());

    // Format commas between members
    const commas = formatter.keywords(",");
    commas.prepend(Formatting.noSpace());
    commas.append(Formatting.oneSpace());
  }

  private formatStructDecl(node: ast.StructDecl): void {
    const formatter = this.getNodeFormatter(node);
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Space around struct name
    formatter.property("name").surround(Formatting.oneSpace());

    // Format braces
    openBrace.prepend(Formatting.oneSpace());
    openBrace.append(Formatting.newLine());

    // Indent struct fields
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());

    // Format commas between fields
    const commas = formatter.keywords(",");
    commas.prepend(Formatting.noSpace());
    commas.append(Formatting.newLine());

    // Format colons in field declarations
    const colons = formatter.keywords(":");
    colons.prepend(Formatting.noSpace());
    colons.append(Formatting.oneSpace());
  }

  private formatVarDecl(node: ast.VarDecl): void {
    const formatter = this.getNodeFormatter(node);

    // Space after 'var' keyword
    formatter.keyword("var").append(Formatting.oneSpace());

    // Format colon
    const colon = formatter.keyword(":");
    colon.prepend(Formatting.noSpace());
    colon.append(Formatting.oneSpace());
    // Format assignment operator
    const equals = formatter.keyword("=");
    equals.surround(Formatting.oneSpace());

    // Format semicolon
    formatter.keyword(";").prepend(Formatting.noSpace());
  }

  private formatFunctionBlockDecl(node: ast.FunctionBlockDecl): void {
    const formatter = this.getNodeFormatter(node);
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Space around functionblock name
    formatter.property("name").surround(Formatting.oneSpace());

    // Format braces
    openBrace.prepend(Formatting.oneSpace());
    openBrace.append(Formatting.newLine());

    // Indent function block content
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());

    // Add spacing between members
    for (let i = 0; i < node.members.length - 1; i++) {
      formatter.node(node.members[i]).append(Formatting.newLine());
    }
  }

  private formatControlUnit(node: ast.ControlUnit): void {
    const formatter = this.getNodeFormatter(node);
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Space after 'unit' keyword
    formatter.keyword("unit").append(Formatting.oneSpace());

    // Format condition or time expressions
    if (node.condition) {
      const openParen = formatter.keyword("(");
      const closeParen = formatter.keyword(")");
      openParen.prepend(Formatting.oneSpace());
      openParen.append(Formatting.noSpace());
      closeParen.prepend(Formatting.noSpace());
      closeParen.append(Formatting.oneSpace());
    }

    // Format braces
    openBrace.prepend(Formatting.oneSpace());
    openBrace.append(Formatting.newLine());

    // Indent statements inside control unit
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());
  }
  private formatIfStmt(node: ast.IfStmt): void {
    const formatter = this.getNodeFormatter(node);
    const openParen = formatter.keyword("(");
    const closeParen = formatter.keyword(")");
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Format condition parentheses
    openParen.prepend(Formatting.oneSpace());
    openParen.append(Formatting.noSpace());
    closeParen.prepend(Formatting.noSpace());
    closeParen.append(Formatting.oneSpace());

    // Format braces
    openBrace.prepend(Formatting.noSpace());
    openBrace.append(Formatting.newLine());

    // Indent statements
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());

    // Format else if statements - put on same line as closing brace
    for (const elseIf of node.elseIfStmts) {
      formatter.node(elseIf).prepend(Formatting.oneSpace());
    }

    // Format else statement - put on same line as closing brace
    if (node.elseStmt) {
      formatter.node(node.elseStmt).prepend(Formatting.oneSpace());
    }
  }
  private formatElseIfStmt(node: ast.ElseIfStmt): void {
    const formatter = this.getNodeFormatter(node);
    const openParen = formatter.keyword("(");
    const closeParen = formatter.keyword(")");
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Format 'else if' keywords
    formatter.keyword("else").append(Formatting.oneSpace());
    formatter.keyword("if").append(Formatting.noSpace());

    // Format condition parentheses
    openParen.prepend(Formatting.noSpace());
    openParen.append(Formatting.noSpace());
    closeParen.prepend(Formatting.noSpace());
    closeParen.append(Formatting.oneSpace());

    // Format braces
    openBrace.prepend(Formatting.noSpace());
    openBrace.append(Formatting.newLine());

    // Indent statements
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());
  }

  private formatElseStmt(node: ast.ElseStmt): void {
    const formatter = this.getNodeFormatter(node);
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Format 'else' keyword
    formatter.keyword("else").append(Formatting.noSpace());

    // Format braces - consistent spacing
    openBrace.prepend(Formatting.oneSpace());
    openBrace.append(Formatting.newLine());

    // Indent statements
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());
  }
  private formatWhileStmt(node: ast.WhileStmt): void {
    const formatter = this.getNodeFormatter(node);
    const openParen = formatter.keyword("(");
    const closeParen = formatter.keyword(")");
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Format parentheses
    openParen.prepend(Formatting.oneSpace());
    openParen.append(Formatting.noSpace());
    closeParen.prepend(Formatting.noSpace());
    closeParen.append(Formatting.oneSpace());

    // Format braces
    openBrace.prepend(Formatting.noSpace());
    openBrace.append(Formatting.newLine());

    // Indent statements
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());
  }
  private formatForStmt(node: ast.ForStmt): void {
    const formatter = this.getNodeFormatter(node);
    const openParen = formatter.keyword("(");
    const closeParen = formatter.keyword(")");
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Format parentheses
    openParen.prepend(Formatting.oneSpace());
    openParen.append(Formatting.noSpace());
    closeParen.prepend(Formatting.noSpace());
    closeParen.append(Formatting.oneSpace());
    // Format 'to' and 'by' keywords
    formatter.keyword("to").surround(Formatting.oneSpace());
    formatter.keyword("by").surround(Formatting.oneSpace());

    // Format braces
    openBrace.prepend(Formatting.noSpace());
    openBrace.append(Formatting.newLine());

    // Indent statements
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());
  }
  private formatSwitchStmt(node: ast.SwitchStmt): void {
    const formatter = this.getNodeFormatter(node);
    const openParen = formatter.keyword("(");
    const closeParen = formatter.keyword(")");
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Format parentheses
    openParen.prepend(Formatting.oneSpace());
    openParen.append(Formatting.noSpace());
    closeParen.prepend(Formatting.noSpace());
    closeParen.append(Formatting.oneSpace());

    // Format braces
    openBrace.prepend(Formatting.noSpace());
    openBrace.append(Formatting.newLine());

    // Indent case statements
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());

    // Format case colons
    const colons = formatter.keywords(":");
    colons.prepend(Formatting.noSpace());
    colons.append(Formatting.oneSpace());
  }

  private formatCaseOption(node: ast.CaseOption): void {
    const formatter = this.getNodeFormatter(node);
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Format colon
    const colon = formatter.keyword(":");
    colon.prepend(Formatting.noSpace());
    colon.append(Formatting.oneSpace());

    // Format braces
    openBrace.prepend(Formatting.noSpace());
    openBrace.append(Formatting.newLine());

    // Indent statements inside case
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());

    // Format commas between case literals
    const commas = formatter.keywords(",");
    commas.prepend(Formatting.noSpace());
    commas.append(Formatting.oneSpace());
  }

  private formatDefaultOption(node: ast.DefaultOption): void {
    const formatter = this.getNodeFormatter(node);
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Format colon
    const colon = formatter.keyword(":");
    colon.prepend(Formatting.noSpace());
    colon.append(Formatting.oneSpace());

    // Format braces
    openBrace.prepend(Formatting.noSpace());
    openBrace.append(Formatting.newLine());

    // Indent statements inside default
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());
  }

  private formatAfterStmt(node: ast.AfterStmt): void {
    const formatter = this.getNodeFormatter(node);
    const openParen = formatter.keyword("(");
    const closeParen = formatter.keyword(")");
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Format keywords
    formatter.keyword("after").append(Formatting.oneSpace());
    formatter.keyword("if").surround(Formatting.oneSpace());
    formatter.keyword("then").surround(Formatting.oneSpace());

    // Format parentheses
    openParen.prepend(Formatting.noSpace());
    openParen.append(Formatting.noSpace());
    closeParen.prepend(Formatting.noSpace());
    closeParen.append(Formatting.oneSpace());

    // Format braces
    openBrace.prepend(Formatting.noSpace());
    openBrace.append(Formatting.newLine());

    // Indent statements
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());
  }

  private formatEdgeStmt(
    node: ast.OnRisingEdgeStmt | ast.OnFallingEdgeStmt
  ): void {
    const formatter = this.getNodeFormatter(node);
    const openParen = formatter.keyword("(");
    const closeParen = formatter.keyword(")");
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Format parentheses
    openParen.prepend(Formatting.noSpace());
    openParen.append(Formatting.noSpace());
    closeParen.prepend(Formatting.noSpace());
    closeParen.append(Formatting.oneSpace());

    // Format braces
    openBrace.prepend(Formatting.noSpace());
    openBrace.append(Formatting.newLine());

    // Indent statements
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());
  }

  private formatUseStmt(node: ast.UseStmt): void {
    const formatter = this.getNodeFormatter(node);
    const openParen = formatter.keyword("(");
    const closeParen = formatter.keyword(")");
    const arrow = formatter.keyword("->");

    // Format 'use' keyword
    formatter.keyword("use").append(Formatting.oneSpace());

    // Format parentheses
    openParen.prepend(Formatting.noSpace());
    openParen.append(Formatting.noSpace());
    closeParen.prepend(Formatting.noSpace());
    closeParen.append(Formatting.oneSpace());

    // Format arrow
    arrow.prepend(Formatting.oneSpace());
    arrow.append(Formatting.oneSpace());

    // Format commas in input arguments
    const commas = formatter.keywords(",");
    commas.prepend(Formatting.noSpace());
    commas.append(Formatting.oneSpace());

    // Format colons in mappings
    const colons = formatter.keywords(":");
    colons.prepend(Formatting.noSpace());
    colons.append(Formatting.oneSpace());

    // Format semicolon
    formatter.keyword(";").prepend(Formatting.noSpace());
  }

  private formatBinExpr(node: ast.BinExpr): void {
    const formatter = this.getNodeFormatter(node);

    // Add spaces around binary operators
    const operators = [
      "&&",
      "||",
      "==",
      "!=",
      "<",
      "<=",
      ">",
      ">=",
      "+",
      "-",
      "*",
      "/",
    ];
    for (const op of operators) {
      const opNodes = formatter.keywords(op as any);
      opNodes.surround(Formatting.oneSpace());
    }
  }

  private formatArrayLiteral(node: ast.ArrayLiteral): void {
    const formatter = this.getNodeFormatter(node);
    const openBracket = formatter.keyword("[");
    const closeBracket = formatter.keyword("]");

    // No space inside brackets
    openBracket.append(Formatting.noSpace());
    closeBracket.prepend(Formatting.noSpace());

    // Format commas
    const commas = formatter.keywords(",");
    commas.prepend(Formatting.noSpace());
    commas.append(Formatting.oneSpace());
  }

  private formatStructLiteral(node: ast.StructLiteral): void {
    const formatter = this.getNodeFormatter(node);
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Space inside braces for struct literals
    openBrace.append(Formatting.oneSpace());
    closeBrace.prepend(Formatting.oneSpace());

    // Format commas
    const commas = formatter.keywords(",");
    commas.prepend(Formatting.noSpace());
    commas.append(Formatting.oneSpace());

    // Format colons
    const colons = formatter.keywords(":");
    colons.prepend(Formatting.noSpace());
    colons.append(Formatting.oneSpace());
  }

  private formatAssignmentStmt(node: ast.AssignmentStmt): void {
    const formatter = this.getNodeFormatter(node);

    // Format assignment operator with spaces around it
    const equals = formatter.keyword("=");
    equals.surround(Formatting.oneSpace());

    // Format semicolon
    formatter.keyword(";").prepend(Formatting.noSpace());
  }
  private formatFunctionBlockInputs(node: ast.FunctionBlockInputs): void {
    const formatter = this.getNodeFormatter(node);
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Format 'inputs' keyword
    formatter.keyword("inputs").append(Formatting.noSpace());

    // Format braces
    openBrace.prepend(Formatting.oneSpace());
    openBrace.append(Formatting.newLine());

    // Indent inputs
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());
  }

  private formatFunctionBlockOutputs(node: ast.FunctionBlockOutputs): void {
    const formatter = this.getNodeFormatter(node);
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Format 'outputs' keyword
    formatter.keyword("outputs").append(Formatting.noSpace());

    // Format braces
    openBrace.prepend(Formatting.oneSpace());
    openBrace.append(Formatting.newLine());

    // Indent outputs
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());
  }

  private formatFunctionBlockLocals(node: ast.FunctionBlockLocals): void {
    const formatter = this.getNodeFormatter(node);
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Format 'locals' keyword
    formatter.keyword("locals").append(Formatting.noSpace());

    // Format braces
    openBrace.prepend(Formatting.oneSpace());
    openBrace.append(Formatting.newLine());

    // Indent locals
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());
  }

  private formatFunctionBlockLogic(node: ast.FunctionBlockLogic): void {
    const formatter = this.getNodeFormatter(node);
    const openBrace = formatter.keyword("{");
    const closeBrace = formatter.keyword("}");

    // Format 'logic' keyword
    formatter.keyword("logic").append(Formatting.noSpace());

    // Format braces
    openBrace.prepend(Formatting.oneSpace());
    openBrace.append(Formatting.newLine());

    // Indent logic statements
    formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());

    // Format closing brace
    closeBrace.prepend(Formatting.newLine());
  }
}
