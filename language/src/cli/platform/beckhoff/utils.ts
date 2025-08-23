import { ControlUnit, Expr } from "../../../language/generated/ast.js";

export function isScheduledControlUnit(
  unit: ControlUnit
): unit is ControlUnit & { time: string } {
  return !!unit.time;
}

export function isConditionalControlUnit(
  unit: ControlUnit
): unit is ControlUnit & { condition: Expr } {
  return !!unit.condition;
}

export function isRegularControlUnit(unit: ControlUnit): boolean {
  return !unit.time && !unit.condition;
}
