import {
  Controller,
  ControllerComponent,
  isPortGroup,
  isDatapoint,
  PortGroup,
  Datapoint,
} from "../../generated/ast.js";

/**
 * Get all components (PortGroup or Datapoint) from a controller or array of components.
 */
export function getComponents(
  controllerOrComponents: Controller | ControllerComponent[]
): ControllerComponent[] {
  const components = Array.isArray(controllerOrComponents)
    ? controllerOrComponents
    : controllerOrComponents.components ?? [];
  // Only return PortGroup or Datapoint
  return components.filter((c) => isPortGroup(c) || isDatapoint(c));
}

/**
 * Get all PortGroups from a controller or array of components.
 */
export function getPortGroups(
  controllerOrComponents: Controller | ControllerComponent[]
): PortGroup[] {
  const components = Array.isArray(controllerOrComponents)
    ? controllerOrComponents
    : controllerOrComponents.components ?? [];
  return components.filter(isPortGroup);
}

/**
 * Get all Datapoints from a controller or array of components.
 */
export function getDatapoints(
  controllerOrComponents: Controller | ControllerComponent[]
): Datapoint[] {
  const components = Array.isArray(controllerOrComponents)
    ? controllerOrComponents
    : controllerOrComponents.components ?? [];
  return components.filter(isDatapoint);
}
