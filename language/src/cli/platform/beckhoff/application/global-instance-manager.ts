import {
  ControlModel,
  HardwareModel,
  UseStmt,
  Statement,
  AfterStmt,
  ControlUnit,
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
 * Manages the assignment and tracking of global function block (FB) instances, edge detection instances,
 * and timer instances within a Beckhoff application context.
 */
export class GlobalInstanceManager {
  private readonly fbInstanceMap = new Map<
    Statement | ControlUnit | string,
    InstanceInfo
  >();
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
    const idx = this.fbInstanceCounter++;
    const instanceName = `${fbType}Instance${idx}`;
    const info: FBInstanceInfo = { kind: "fb", instanceName, fbType };
    this.fbInstanceMap.set(useStmt, info);
    return info;
  }

  public getOrAssignUnitTriggerInstance(
    unit: ControlUnit
  ): EdgeStmtInstanceInfo {
    if (this.fbInstanceMap.has(unit)) {
      return this.fbInstanceMap.get(unit)! as EdgeStmtInstanceInfo;
    }
    const idx = this.fbInstanceCounter++;
    const instanceName = `R_TRIG_UnitInstance_${unit.name}${idx}`;
    const info: EdgeStmtInstanceInfo = {
      kind: "edge",
      instanceName,
      edgeType: "rising",
      fbType: "R_TRIG",
    };
    this.fbInstanceMap.set(unit, info);
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
    let prefix = edgeType === "rising" ? "R_TRIG_Instance" : "F_TRIG_Instance";
    const idx = this.fbInstanceCounter++;
    const instanceName = `${prefix}${idx}`;
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
    const tonName = `TON_AfterInstance${idx}`;
    const triggerName = `R_TRIG_AfterInstance${idx}`;
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

  public getDaliComInstance(daliComType: string): FBInstanceInfo | undefined {
    const key = `daliCom_${daliComType}`;
    const instance = this.fbInstanceMap.get(key);
    return instance?.kind === "fb" ? instance : undefined;
  }

  public addDaliComInstance(daliComType: string): void {
    const fbType = daliComType;
    const key = `daliCom_${fbType}`;
    if (!this.fbInstanceMap.has(key)) {
      const idx = this.fbInstanceCounter++;
      const instanceName = `${fbType}Instance${idx}`;
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

  public assignFBInstances(
    mainStatements: Statement[],
    controlUnits: ControlUnit[]
  ) {
    StatementTraverser.traverse(mainStatements, {
      visitUseStmt: (stmt) => {
        this.getOrAssignUseStmtInstance(stmt);
      },
      visitOnRisingEdge: (stmt) => {
        this.getOrAssignEdgeStmtInstance(stmt, "rising", "R_TRIG");
      },
      visitOnFallingEdge: (stmt) => {
        this.getOrAssignEdgeStmtInstance(stmt, "falling", "F_TRIG");
      },
      visitAfterStmt: (stmt) => {
        this.getOrAssignAfterStmtInstance(stmt);
      },
    });

    controlUnits
      .filter((unit) => unit.time || unit.isOnce)
      .forEach((unit) => {
        this.getOrAssignUnitTriggerInstance(unit);
      });
  }
}
