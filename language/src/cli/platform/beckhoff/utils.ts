import {
  ControlUnit,
  Expr,
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
