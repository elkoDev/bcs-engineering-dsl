import {
  Statement,
  isForStmt,
  isIfStmt,
  isWhileStmt,
  isSwitchStmt,
  ForStmt,
} from "../../../../language/generated/ast.js";
import { LoopVariableInfo } from "../models/types.js";

/**
 * Analyzes statements to extract loop variable declarations.
 */
export class LoopVariableAnalyzer {
  /**
   * Recursively collect all loop variables (from ForStmt) in a list of statements.
   * Returns an array of unique loop variables found.
   */
  public static collectLoopVars(stmts: Statement[]): LoopVariableInfo[] {
    const found = new Map<string, LoopVariableInfo>();
    this.collectLoopVarsInternal(stmts, found);
    return Array.from(found.values());
  }

  private static collectLoopVarsInternal(
    stmts: Statement[],
    found: Map<string, LoopVariableInfo>
  ): void {
    for (const s of stmts) {
      if (isForStmt(s)) {
        this.handleForLoopVar(s, found);
        this.collectLoopVarsInternal(s.stmts, found);
      } else if (isIfStmt(s)) {
        this.collectLoopVarsInternal(s.stmts, found);
        for (const e of s.elseIfStmts)
          this.collectLoopVarsInternal(e.stmts, found);
        if (s.elseStmt) this.collectLoopVarsInternal(s.elseStmt.stmts, found);
      } else if (isWhileStmt(s)) {
        this.collectLoopVarsInternal(s.stmts, found);
      } else if (isSwitchStmt(s)) {
        for (const c of s.cases) this.collectLoopVarsInternal(c.stmts, found);
        if (s.default) this.collectLoopVarsInternal(s.default.stmts, found);
      }
    }
  }

  private static handleForLoopVar(
    stmt: ForStmt,
    found: Map<string, LoopVariableInfo>
  ): void {
    if (!found.has(stmt.loopVar.name)) {
      found.set(stmt.loopVar.name, {
        name: stmt.loopVar.name,
        type: stmt.loopVar.typeRef.type ?? "INT",
        init: stmt.loopVar.init,
      });
    }
  }
}
