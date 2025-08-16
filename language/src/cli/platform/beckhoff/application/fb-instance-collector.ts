import { Statement } from "../../../../language/generated/ast.js";
import { StatementTraverser } from "./statement-traverser.js";

/**
 * Function block instance collector for type converter (function-block scoped).
 * Uses simple naming conventions suitable for local function block scope.
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
    StatementTraverser.traverse(stmts, {
      visitOnRisingEdge: (stmt) => {
        if (!this.fbInstanceMap.has(stmt)) {
          this.fbInstanceMap.set(stmt, `r_TRIGInstance${this.rTrigCounter++}`);
        }
      },
      visitOnFallingEdge: (stmt) => {
        if (!this.fbInstanceMap.has(stmt)) {
          this.fbInstanceMap.set(stmt, `f_TRIGInstance${this.fTrigCounter++}`);
        }
      },
      visitAfterStmt: (stmt) => {
        if (!this.fbAfterMap.has(stmt)) {
          this.fbAfterMap.set(stmt, `tonAfter${this.tonCounter++}`);
        }
      },
    });
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
}
