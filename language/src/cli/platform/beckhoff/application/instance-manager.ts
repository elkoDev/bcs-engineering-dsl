import {
  ControlModel,
  HardwareModel,
  UseStmt,
  Statement,
  AfterStmt,
  isFunctionBlockDecl,
  ControlUnit,
  isUseStmt,
  isOnRisingEdgeStmt,
  isOnFallingEdgeStmt,
  isIfStmt,
  isWhileStmt,
  isForStmt,
  isSwitchStmt,
  isAfterStmt,
} from "../../../../language/generated/ast.js";
import {
  InstanceInfo,
  FBInstanceInfo,
  AfterStmtInstanceInfo,
} from "../models/types.js";
import { detectDaliComType } from "../utils.js";

/**
 * Handles FB instance creation and management
 */
export class InstanceManager {
  private readonly fbInstanceMap = new Map<any, InstanceInfo>();
  private fbInstanceCounter = 1;
  private readonly controlModel: ControlModel;
  private readonly hardwareModel: HardwareModel;

  constructor(controlModel: ControlModel, hardwareModel: HardwareModel) {
    this.controlModel = controlModel;
    this.hardwareModel = hardwareModel;
  }

  reset() {
    this.fbInstanceMap.clear();
    this.fbInstanceCounter = 1;
  }

  // Generate a globally unique FB instance name
  createUniqueFBInstanceName(fbType: string): string {
    const name = `${fbType.charAt(0).toLowerCase()}${fbType.slice(1)}Instance${
      this.fbInstanceCounter
    }`;
    this.fbInstanceCounter++;
    return name;
  }

  // Assign or get a unique FB instance for a UseStmt
  getOrAssignFBInstance(useStmt: UseStmt): FBInstanceInfo {
    if (this.fbInstanceMap.has(useStmt)) {
      return this.fbInstanceMap.get(useStmt)! as FBInstanceInfo;
    }
    const fbType = useStmt.functionBlockRef.ref?.name ?? "UNKNOWN_FB";
    const instanceName = this.createUniqueFBInstanceName(fbType);
    const info: FBInstanceInfo = { kind: "fb", instanceName, fbType };
    this.fbInstanceMap.set(useStmt, info);
    return info;
  }

  // Assign or get a unique FB instance for edge detection
  getOrAssignEdgeFBInstance(
    stmt: Statement,
    type: "rising" | "falling",
    fbType: string
  ): FBInstanceInfo {
    if (this.fbInstanceMap.has(stmt)) {
      return this.fbInstanceMap.get(stmt)! as FBInstanceInfo;
    }
    const instanceName = this.createUniqueFBInstanceName(fbType);
    const info: FBInstanceInfo = { kind: "fb", instanceName, fbType };
    this.fbInstanceMap.set(stmt, info);
    return info;
  }

  // Assign or get a unique AfterStmt instance (TON timer)
  getOrAssignAfterStmtInstance(stmt: AfterStmt): AfterStmtInstanceInfo {
    if (this.fbInstanceMap.has(stmt)) {
      return this.fbInstanceMap.get(stmt)! as AfterStmtInstanceInfo;
    }
    const idx = this.fbInstanceCounter++;
    const tonName = `tonAfter${idx}`;
    const ptValue = stmt.time;
    const info: AfterStmtInstanceInfo = {
      kind: "after",
      tonName,
      ptValue,
    };
    this.fbInstanceMap.set(stmt, info);
    return info;
  }

  // Get all instance declarations for main program
  getAllFBInstanceDeclarations(): Array<{
    instanceName: string;
    fbType: string;
  }> {
    // Use a Set to avoid duplicates if the same instance is referenced by multiple keys
    const seen = new Set<string>();
    const result: Array<{ instanceName: string; fbType: string }> = [];
    for (const info of this.fbInstanceMap.values()) {
      if (info.kind === "fb" && !seen.has(info.instanceName)) {
        seen.add(info.instanceName);
        result.push({ instanceName: info.instanceName, fbType: info.fbType });
      }
    }
    return result;
  }

  // Get all AfterStmt instance declarations for main program
  getAllAfterStmtDeclarations(): AfterStmtInstanceInfo[] {
    return Array.from(this.fbInstanceMap.values()).filter(
      (info): info is AfterStmtInstanceInfo => info.kind === "after"
    );
  }

  addRequiredAdditionalFBInstances() {
    // Check if any extern function block from Tc3_DALI is used
    const hasExternDaliFB = this.controlModel.externTypeDecls.some(
      (item) =>
        isFunctionBlockDecl(item) &&
        item.isExtern &&
        item.name.startsWith("FB_DALI")
    );
    if (!hasExternDaliFB) return;

    // Try to detect the DALI communication FB type from hardware
    const daliComType = detectDaliComType(this.hardwareModel);
    if (!daliComType) {
      throw new Error(
        "DALI communication moduleType not found in hardware. Please declare a portgroup with a supported DALI moduleType (e.g., KL6811, KL6821, EL6821) to use FB_DALI function blocks."
      );
    }
    const fbType = daliComType;
    const key = `daliCom_${fbType}`;
    if (!this.fbInstanceMap.has(key)) {
      const instanceName = this.createUniqueFBInstanceName(fbType);
      this.fbInstanceMap.set(key, { kind: "fb", instanceName, fbType });
    }
  }

  assignFBInstancesFromControlUnit(controlUnit: ControlUnit) {
    const useStmts = controlUnit.stmts.filter(isUseStmt);
    for (const useStmt of useStmts) {
      this.getOrAssignFBInstance(useStmt);
    }
  }

  assignEdgeDetectionInstances(mainStatements: Statement[]) {
    const walk = (stmts: Statement[]) => {
      for (const stmt of stmts) {
        if (isOnRisingEdgeStmt(stmt)) {
          this.getOrAssignEdgeFBInstance(stmt, "rising", "R_TRIG");
          walk(stmt.stmts);
        } else if (isOnFallingEdgeStmt(stmt)) {
          this.getOrAssignEdgeFBInstance(stmt, "falling", "F_TRIG");
          walk(stmt.stmts);
        } else if (isIfStmt(stmt)) {
          walk(stmt.stmts);
          for (const elseIf of stmt.elseIfStmts) walk(elseIf.stmts);
          if (stmt.elseStmt) walk(stmt.elseStmt.stmts);
        } else if (isWhileStmt(stmt)) {
          walk(stmt.stmts);
        } else if (isForStmt(stmt)) {
          walk(stmt.stmts);
        } else if (isSwitchStmt(stmt)) {
          for (const c of stmt.cases) walk(c.stmts);
          if (stmt.default) walk(stmt.default.stmts);
        }
      }
    };
    walk(mainStatements);
  }

  // Walk statements to collect AfterStmt instances for unique TON/vars
  assignAfterStmtInstances(mainStatements: Statement[]) {
    const walk = (stmts: Statement[]) => {
      for (const stmt of stmts) {
        if (isAfterStmt(stmt)) {
          this.getOrAssignAfterStmtInstance(stmt);
          walk((stmt as any).stmts ?? []);
        } else if (isIfStmt(stmt)) {
          walk(stmt.stmts);
          for (const elseIf of stmt.elseIfStmts) walk(elseIf.stmts);
          if (stmt.elseStmt) walk(stmt.elseStmt.stmts);
        } else if (isWhileStmt(stmt)) {
          walk(stmt.stmts);
        } else if (isForStmt(stmt)) {
          walk(stmt.stmts);
        } else if (isSwitchStmt(stmt)) {
          for (const c of stmt.cases) walk(c.stmts);
          if (stmt.default) walk(stmt.default.stmts);
        } else if (isOnRisingEdgeStmt(stmt) || isOnFallingEdgeStmt(stmt)) {
          walk(stmt.stmts);
        }
      }
    };
    walk(mainStatements);
  }

  // Get the DALI com instance for library specials
  getDaliComInstance(daliComType: string): FBInstanceInfo | undefined {
    const key = `daliCom_${daliComType}`;
    const instance = this.fbInstanceMap.get(key);
    return instance?.kind === "fb" ? instance : undefined;
  }
}
