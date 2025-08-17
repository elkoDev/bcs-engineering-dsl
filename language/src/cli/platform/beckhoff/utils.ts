import {
  ControlModel,
  ControlUnit,
  Expr,
  isControlUnit,
  Statement,
} from "../../../language/generated/ast.js";

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
