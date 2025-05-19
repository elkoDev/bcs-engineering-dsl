import {
  ControlModel,
  ControlUnit,
  Expr,
  HardwareModel,
  isControlUnit,
  Statement,
} from "../../../language/generated/ast.js";
import { getControllers } from "../../../language/hardware/utils/hardware-definition-utils.js";
import { getPortGroups } from "../../../language/hardware/utils/component-utils.js";

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
  const mapping: Record<string, string> = {
    KL6811: "FB_KL6811Communication",
    KL6821: "FB_KL6821Communication",
    EL6821: "FB_EL6821Communication",
  };

  for (const ctrl of getControllers(hardwareModel)) {
    for (const portGroup of getPortGroups(ctrl)) {
      if (portGroup.module?.ref) {
        const module = portGroup.module.ref;
        if (module && mapping[module.productCode]) {
          return mapping[module.productCode];
        }
      }
    }
  }
  return undefined;
}

export function isScheduledControlUnit(
  unit: ControlUnit
): unit is ControlUnit & ScheduledControlUnit {
  return !!unit.time;
}

export function isConditionalControlUnit(
  unit: ControlUnit
): unit is ControlUnit & ConditionalControlUnit {
  return !!unit.condition;
}

export function isRegularControlUnit(
  unit: ControlUnit
): unit is ControlUnit & RegularControlUnit {
  return !unit.time && !unit.condition;
}

export function extractControlUnits(controlModel: ControlModel): {
  scheduled: ScheduledControlUnit[];
  conditional: ConditionalControlUnit[];
  regular: RegularControlUnit[];
} {
  const controlUnits = controlModel.controlBlock.items.filter(isControlUnit);

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
        condition: controlUnit.condition,
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
