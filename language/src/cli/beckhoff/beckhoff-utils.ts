import {
  ControlModel,
  ControlUnit,
  Expr,
  HardwareModel,
  isControlUnit,
  Statement,
} from "../../language/generated/ast.js";

export interface RegularControlUnit {
  name: string;
  stmts: Statement[];
}

export interface ScheduledControlUnit {
  name: string;
  timeLiteral: string;
  stmts: Statement[];
}

export interface ConditionalControlUnit {
  name: string;
  runOnce: boolean;
  condition: Expr;
  stmts: Statement[];
}

export function detectDaliComType(
  hardwareModel: HardwareModel
): string | undefined {
  // look at moduleType on any port-group – extend the map if you need more
  const mapping: Record<string, string> = {
    KL6811: "FB_KL6811Communication",
    KL6821: "FB_KL6821Communication",
    EL6821: "FB_EL6821Communication",
  };

  for (const ctrl of hardwareModel.controllers) {
    for (const comp of ctrl.components) {
      if ("moduleType" in comp && mapping[comp.moduleType]) {
        return mapping[comp.moduleType];
      }
    }
  }
  return undefined;
}

function isScheduledControlUnit(controlUnit: ControlUnit): boolean {
  return !!controlUnit?.time;
}

function isConditionalControlUnit(controlUnit: ControlUnit): boolean {
  return !!controlUnit?.condition;
}

function isRegularControlUnit(controlUnit: ControlUnit): boolean {
  return (
    !isScheduledControlUnit(controlUnit) &&
    !isConditionalControlUnit(controlUnit)
  );
}

export function extractControlUnits(controlModel: ControlModel): {
  scheduled: ScheduledControlUnit[];
  conditional: ConditionalControlUnit[];
  regular: RegularControlUnit[];
} {
  const controlUnits = controlModel.controlBlock.items.filter((item) =>
    isControlUnit(item)
  ) as ControlUnit[];

  const scheduled: ScheduledControlUnit[] = [];
  const conditional: ConditionalControlUnit[] = [];
  const regular: RegularControlUnit[] = [];

  for (const controlUnit of controlUnits) {
    if (isScheduledControlUnit(controlUnit)) {
      scheduled.push({
        name: controlUnit.name,
        timeLiteral: controlUnit.time!,
        stmts: controlUnit.stmts,
      });
    } else if (isConditionalControlUnit(controlUnit)) {
      conditional.push({
        name: controlUnit.name,
        runOnce: !!controlUnit.isOnce,
        condition: controlUnit.condition!,
        stmts: controlUnit.stmts,
      });
    } else if (isRegularControlUnit(controlUnit)) {
      regular.push({
        name: controlUnit.name,
        stmts: controlUnit.stmts,
      });
    }
  }

  return { scheduled, conditional, regular };
}
