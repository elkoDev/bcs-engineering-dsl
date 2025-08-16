import { Statement } from "../../../../language/generated/ast.js";

/**
 * Generic statement traverser that can be used by different collectors.
 * Provides visitor pattern for statement traversal with callback functions.
 */
export class StatementTraverser {
  /**
   * Traverse statements and call visitor functions for specific statement types
   */
  public static traverse(
    stmts: Statement[],
    visitor: {
      visitOnRisingEdge?(stmt: any): void;
      visitOnFallingEdge?(stmt: any): void;
      visitAfterStmt?(stmt: any): void;
      visitUseStmt?(stmt: any): void;
      visitOther?(stmt: any): void;
    }
  ): void {
    const walk = (statements: Statement[]) => {
      for (const stmt of statements) {
        switch (stmt.$type) {
          case "OnRisingEdgeStmt": {
            visitor.visitOnRisingEdge?.(stmt);
            walk(stmt.stmts ?? []);
            break;
          }
          case "OnFallingEdgeStmt": {
            visitor.visitOnFallingEdge?.(stmt);
            walk(stmt.stmts ?? []);
            break;
          }
          case "AfterStmt": {
            visitor.visitAfterStmt?.(stmt);
            walk(stmt.stmts ?? []);
            break;
          }
          case "UseStmt": {
            visitor.visitUseStmt?.(stmt);
            break;
          }
          case "IfStmt": {
            walk(stmt.stmts ?? []);
            for (const elseIf of stmt.elseIfStmts ?? []) {
              walk(elseIf.stmts ?? []);
            }
            if (stmt.elseStmt) {
              walk(stmt.elseStmt.stmts ?? []);
            }
            break;
          }
          case "WhileStmt":
          case "ForStmt": {
            walk(stmt.stmts ?? []);
            break;
          }
          case "SwitchStmt": {
            for (const c of stmt.cases ?? []) {
              walk(c.stmts ?? []);
            }
            if (stmt.default) {
              walk(stmt.default.stmts ?? []);
            }
            break;
          }
          default: {
            visitor.visitOther?.(stmt);
            if ("stmts" in stmt && stmt.stmts) {
              walk(stmt.stmts as Statement[]);
            }
            break;
          }
        }
      }
    };

    walk(stmts);
  }
}
