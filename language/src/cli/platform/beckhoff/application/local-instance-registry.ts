import { Statement } from "../../../../language/generated/ast.js";
import {
  AfterStmtInstanceInfo,
  EdgeStmtInstanceInfo,
  FBInstanceInfo,
} from "../models/types.js";
import { StatementTraverser } from "./statement-traverser.js";

/**
 * Local instance registry for function block scope.
 * Collects and manages instances within a single function block using simple naming conventions.
 * Handles edge detection (R_TRIG, F_TRIG), timer (TON), and USE statement instances for local scope.
 */
export class LocalInstanceRegistry {
  private readonly edgeStmtInstanceMap = new Map<
    Statement,
    EdgeStmtInstanceInfo
  >();
  private readonly afterStmtInstanceMap = new Map<
    Statement,
    AfterStmtInstanceInfo
  >();
  private readonly useStmtInstanceMap = new Map<Statement, FBInstanceInfo>();
  private rTrigCounter = 1;
  private fTrigCounter = 1;
  private tonCounter = 1;
  private useCounter = 1;

  /**
   * Collect instances from the given statements
   */
  public collectFromStatements(stmts: Statement[]): void {
    StatementTraverser.traverse(stmts, {
      visitOnRisingEdge: (stmt) => {
        if (!this.edgeStmtInstanceMap.has(stmt)) {
          this.edgeStmtInstanceMap.set(stmt, {
            kind: "edge",
            instanceName: `R_TRIG_Instance${this.rTrigCounter++}`,
            edgeType: "rising",
            fbType: "R_TRIG",
          });
        }
      },
      visitOnFallingEdge: (stmt) => {
        if (!this.edgeStmtInstanceMap.has(stmt)) {
          this.edgeStmtInstanceMap.set(stmt, {
            kind: "edge",
            instanceName: `F_TRIG_Instance${this.fTrigCounter++}`,
            edgeType: "falling",
            fbType: "F_TRIG",
          });
        }
      },
      visitAfterStmt: (stmt) => {
        if (!this.afterStmtInstanceMap.has(stmt)) {
          const idx = this.tonCounter++;
          this.afterStmtInstanceMap.set(stmt, {
            kind: "after",
            tonName: `TON_AfterInstance${idx}`,
            triggerName: `R_TRIG_AfterInstance${idx}`,
            ptValue: stmt.time,
          });
        }
      },
      visitUseStmt: (stmt) => {
        if (!this.useStmtInstanceMap.has(stmt)) {
          const fbType = stmt.functionBlockRef.ref?.name ?? "UNKNOWN_FB";
          this.useStmtInstanceMap.set(stmt, {
            kind: "fb",
            instanceName: `${fbType.charAt(0).toLowerCase()}${fbType.slice(
              1
            )}Instance${this.useCounter++}`,
            fbType,
          });
        }
      },
    });
  }

  /**
   * Get the collected edge detection instance map
   */
  public getEdgeStmtInstanceMap(): Map<Statement, EdgeStmtInstanceInfo> {
    return this.edgeStmtInstanceMap;
  }

  /**
   * Get the collected after statement instance map
   */
  public getAfterStmtInstanceMap(): Map<Statement, AfterStmtInstanceInfo> {
    return this.afterStmtInstanceMap;
  }

  /**
   * Get the collected use statement instance map
   */
  public getUseStmtInstanceMap(): Map<Statement, FBInstanceInfo> {
    return this.useStmtInstanceMap;
  }
}
