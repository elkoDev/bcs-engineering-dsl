import { Reference } from "langium";
import {
  NamedElement,
  isControlUnit,
  isVarDecl,
} from "../../../../language/generated/ast.js";

export function getQualifiedReferenceName(
  ref: Reference<NamedElement>
): string {
  const [isInControlUnit, unitName] = isControlUnitVariable(ref);
  if (isInControlUnit && unitName && isVarDecl(ref.ref)) {
    return `${unitName}_${getReferenceName(ref)}`;
  }
  return getReferenceName(ref);
}

export function getReferenceName(ref: Reference<NamedElement>): string {
  return (
    ref?.$refText ??
    (console.warn("Unresolved reference:", JSON.stringify(ref, null, 2)),
    "UNRESOLVED_REF")
  );
}

/**
 * Check if a referenced element belongs to a control unit
 * @param ref Reference to check
 * @return Tuple where the first element indicates if it's in a control unit,
 *         and the second element is the control unit name or null
 */
function isControlUnitVariable(
  ref: Reference<NamedElement>
): [boolean, string | null] {
  const container = ref?.ref?.$container;
  return container && isControlUnit(container)
    ? [true, container.name]
    : [false, null];
}
