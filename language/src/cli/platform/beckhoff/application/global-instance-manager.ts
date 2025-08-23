import {
  ControlModel,
  HardwareModel,
  UseStmt,
  Statement,
  AfterStmt,
  ControlUnit,
  isUseStmt,
  EdgeStmt,
} from "../../../../language/generated/ast.js";
import {
  InstanceInfo,
  FBInstanceInfo,
  EdgeStmtInstanceInfo,
  AfterStmtInstanceInfo,
} from "../models/types.js";
import { StatementTraverser } from "./statement-traverser.js";
import { LibraryHandlerManager } from "./library-handlers/library-handler-manager.js";

/**
 * Manages the assignment and tracking of global function block (FB) and timer instances
 * within the Beckhoff application platform. This class ensures unique instance names for
 * function blocks, handles edge detection and timer (AFTER) statements, and manages
 * additional required FB instances based on hardware and control model analysis.
 *
 * Responsibilities include:
 * - Assigning and retrieving unique FB instance information for `UseStmt` and edge detection statements.
 * - Managing timer-on (TON) instances for AFTER statements.
 * - Tracking and providing all declared FB and AFTER statement instances.
 * - Detecting and assigning required communication FBs (e.g., DALI) based on hardware configuration.
 * - Resetting instance state for reuse.
 */
export class GlobalInstanceManager {
  private readonly fbInstanceMap = new Map<Statement | string, InstanceInfo>();
  private fbInstanceCounter = 1;
  private readonly controlModel: ControlModel;
  private readonly hardwareModel: HardwareModel;

  constructor(controlModel: ControlModel, hardwareModel: HardwareModel) {
    this.controlModel = controlModel;
    this.hardwareModel = hardwareModel;
  }

  public reset() {
    this.fbInstanceMap.clear();
    this.fbInstanceCounter = 1;
  }

  public getOrAssignUseStmtInstance(useStmt: UseStmt): FBInstanceInfo {
    if (this.fbInstanceMap.has(useStmt)) {
      return this.fbInstanceMap.get(useStmt)! as FBInstanceInfo;
    }
    const fbType = useStmt.functionBlockRef.ref?.name ?? "UNKNOWN_FB";
    const instanceName = this.createUniqueFBInstanceName(fbType);
    const info: FBInstanceInfo = { kind: "fb", instanceName, fbType };
    this.fbInstanceMap.set(useStmt, info);
    return info;
  }

  public getOrAssignEdgeStmtInstance(
    stmt: EdgeStmt,
    edgeType: "rising" | "falling",
    fbType: string
  ): EdgeStmtInstanceInfo {
    if (this.fbInstanceMap.has(stmt)) {
      return this.fbInstanceMap.get(stmt)! as EdgeStmtInstanceInfo;
    }
    const instanceName = this.createUniqueFBInstanceName(fbType);
    const info: EdgeStmtInstanceInfo = {
      kind: "edge",
      instanceName,
      edgeType,
      fbType,
    };
    this.fbInstanceMap.set(stmt, info);
    return info;
  }

  public getOrAssignAfterStmtInstance(stmt: AfterStmt): AfterStmtInstanceInfo {
    if (this.fbInstanceMap.has(stmt)) {
      return this.fbInstanceMap.get(stmt)! as AfterStmtInstanceInfo;
    }
    const idx = this.fbInstanceCounter++;
    const tonName = `tonAfter${idx}`;
    const triggerName = `rTrigAfter${idx}`;
    const ptValue = stmt.time;
    const info: AfterStmtInstanceInfo = {
      kind: "after",
      tonName,
      ptValue,
      triggerName,
    };
    this.fbInstanceMap.set(stmt, info);
    return info;
  }

  public getDaliComInstance(
    daliComType: string
  ): FBInstanceInfo | undefined {
    const key = `daliCom_${daliComType}`;
    const instance = this.fbInstanceMap.get(key);
    return instance?.kind === "fb" ? instance : undefined;
  }

  public addDaliComInstance(daliComType: string): void {
    const fbType = daliComType;
    const key = `daliCom_${fbType}`;
    if (!this.fbInstanceMap.has(key)) {
      const instanceName = this.createUniqueFBInstanceName(fbType);
      this.fbInstanceMap.set(key, { kind: "fb", instanceName, fbType });
    }
  }

  public getFBInstanceDeclarations(): FBInstanceInfo[] {
    return Array.from(this.fbInstanceMap.values()).filter(
      (info): info is FBInstanceInfo => info.kind === "fb"
    );
  }

  public getEdgeStmtInstanceDeclarations(): EdgeStmtInstanceInfo[] {
    return Array.from(this.fbInstanceMap.values()).filter(
      (info): info is EdgeStmtInstanceInfo => info.kind === "edge"
    );
  }

  public getAfterStmtInstanceDeclarations(): AfterStmtInstanceInfo[] {
    return Array.from(this.fbInstanceMap.values()).filter(
      (info): info is AfterStmtInstanceInfo => info.kind === "after"
    );
  }

  public addRequiredAdditionalFBInstances() {
    LibraryHandlerManager.addRequiredLibraryInstances(
      this.controlModel,
      this.hardwareModel,
      this
    );
  }

  public assignFBInstancesFromControlUnit(controlUnit: ControlUnit) {
    const useStmts = controlUnit.stmts.filter(isUseStmt);
    for (const useStmt of useStmts) {
      this.getOrAssignUseStmtInstance(useStmt);
    }
  }

  public assignEdgeDetectionInstances(mainStatements: Statement[]) {
    StatementTraverser.traverse(mainStatements, {
      visitOnRisingEdge: (stmt) => {
        this.getOrAssignEdgeStmtInstance(stmt, "rising", "R_TRIG");
      },
      visitOnFallingEdge: (stmt) => {
        this.getOrAssignEdgeStmtInstance(stmt, "falling", "F_TRIG");
      },
    });
  }

  public assignAfterStmtInstances(mainStatements: Statement[]) {
    StatementTraverser.traverse(mainStatements, {
      visitAfterStmt: (stmt) => {
        this.getOrAssignAfterStmtInstance(stmt);
      },
    });
  }

  private createUniqueFBInstanceName(fbType: string): string {
    const name = `${fbType.charAt(0).toLowerCase()}${fbType.slice(1)}Instance${
      this.fbInstanceCounter
    }`;
    this.fbInstanceCounter++;
    return name;
  }
}
