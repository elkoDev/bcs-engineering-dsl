import {
  VarDecl,
  ControlUnit,
  Expr,
} from "../../../../language/generated/ast.js";

export type InstanceInfo =
  | UseStmtInstanceInfo
  | EdgeStmtInstanceInfo
  | AfterStmtInstanceInfo;

export interface UseStmtInstanceInfo {
  kind: "use";
  instanceName: string;
  fbType: string;
}

export interface EdgeStmtInstanceInfo {
  kind: "edge";
  instanceName: string;
  edgeType: "rising" | "falling";
}

export interface AfterStmtInstanceInfo {
  kind: "after";
  tonName: string;
  ptValue: string;
  triggerName: string;
}

export interface HardwareDatapoint {
  name: string;
  type: string;
}

export interface HardwareDatapointsResult {
  inputs: HardwareDatapoint[];
  outputs: HardwareDatapoint[];
}

export interface LoopVariableInfo {
  name: string;
  type: string;
  init?: Expr;
}

export class EmittedVarDecl {
  varDecl: VarDecl;
  controlUnit?: ControlUnit;

  constructor(varDecl: VarDecl, controlUnit?: ControlUnit) {
    this.varDecl = varDecl;
    this.controlUnit = controlUnit;
  }

  get name(): string {
    if (this.controlUnit) {
      return `${this.controlUnit.name}_${this.varDecl.name}`;
    }
    return `${this.varDecl.name}`;
  }
}
