import {
  HardwareModel,
  HardwareDefinition,
  Bus,
  NetworkSettings,
  isBus,
  isNetworkSettings,
  Controller,
  isController,
} from "../../generated/ast.js";

export function getControllers(
  modelOrDefs: HardwareModel | HardwareDefinition[]
): Controller[] {
  const defs = Array.isArray(modelOrDefs)
    ? modelOrDefs
    : modelOrDefs.hardwareDefinitions ?? [];
  return defs.filter(isController);
}

/**
 * Get all buses from a hardware model or definitions array.
 */
export function getBuses(
  modelOrDefs: HardwareModel | HardwareDefinition[]
): Bus[] {
  const defs = Array.isArray(modelOrDefs)
    ? modelOrDefs
    : modelOrDefs.hardwareDefinitions ?? [];
  return defs.filter(isBus);
}

/**
 * Get all network settings from a hardware model or definitions array.
 */
export function getNetworkSettings(
  modelOrDefs: HardwareModel | HardwareDefinition[]
): NetworkSettings[] {
  const defs = Array.isArray(modelOrDefs)
    ? modelOrDefs
    : modelOrDefs.hardwareDefinitions ?? [];
  return defs.filter(isNetworkSettings);
}
