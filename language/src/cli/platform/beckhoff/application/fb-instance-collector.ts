import { Statement } from "../../../../language/generated/ast.js";

/**
 * Helper class to collect function block instances from statements.
 * Encapsulates the state and logic for traversing AST and collecting
 * edge detection instances (R_TRIG, F_TRIG) and timer instances (TON).
 */
export class FBInstanceCollector {
  private readonly fbInstanceMap = new Map<any, string>();
  private readonly fbAfterMap = new Map<any, string>();
  private rTrigCounter = 1;
  private fTrigCounter = 1;
  private tonCounter = 1;

  /**
   * Collect instances from the given statements
   */
  public collectFromStatements(stmts: Statement[]): void {
    this.traverseStatements(stmts);
  }

  /**
   * Get the collected edge detection instance map
   */
  public getFBInstanceMap(): Map<any, string> {
    return this.fbInstanceMap;
  }

  /**
   * Get the collected after statement instance map
   */
  public getFBAfterMap(): Map<any, string> {
    return this.fbAfterMap;
  }

  /**
   * Recursively traverse statements and collect instances
   */
  private traverseStatements(stmts: Statement[]): void {
    for (const stmt of stmts) {
      switch (stmt.$type) {
        case "OnRisingEdgeStmt": {
          if (!this.fbInstanceMap.has(stmt)) {
            this.fbInstanceMap.set(
              stmt,
              `r_TRIGInstance${this.rTrigCounter++}`
            );
          }
          this.traverseStatements(stmt.stmts ?? []);
          break;
        }
        case "OnFallingEdgeStmt": {
          if (!this.fbInstanceMap.has(stmt)) {
            this.fbInstanceMap.set(
              stmt,
              `f_TRIGInstance${this.fTrigCounter++}`
            );
          }
          this.traverseStatements(stmt.stmts ?? []);
          break;
        }
        case "AfterStmt": {
          if (!this.fbAfterMap.has(stmt)) {
            this.fbAfterMap.set(stmt, `tonAfter${this.tonCounter++}`);
          }
          this.traverseStatements(stmt.stmts ?? []);
          break;
        }
        case "IfStmt": {
          this.traverseStatements(stmt.stmts ?? []);
          for (const elseIf of stmt.elseIfStmts ?? []) {
            this.traverseStatements(elseIf.stmts ?? []);
          }
          if (stmt.elseStmt) {
            this.traverseStatements(stmt.elseStmt.stmts ?? []);
          }
          break;
        }
        case "WhileStmt":
        case "ForStmt": {
          this.traverseStatements(stmt.stmts ?? []);
          break;
        }
        case "SwitchStmt": {
          for (const c of stmt.cases ?? []) {
            this.traverseStatements(c.stmts ?? []);
          }
          if (stmt.default) {
            this.traverseStatements(stmt.default.stmts ?? []);
          }
          break;
        }
        default: {
          if ("stmts" in stmt && stmt.stmts) {
            this.traverseStatements(stmt.stmts as Statement[]);
          }
          break;
        }
      }
    }
  }
}
