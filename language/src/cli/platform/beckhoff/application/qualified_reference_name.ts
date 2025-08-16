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

/**
 * Helper function to extract the name from a reference with improved debugging
 * This function properly handles all types of references in our AST
 */
export function getReferenceName(ref: Reference<NamedElement>): string {
  return (
    ref?.$refText ??
    (console.warn("Unresolved reference:", JSON.stringify(ref, null, 2)),
    "UNRESOLVED_REF")
  );
}

/**
 * Check if a referenced element belongs to a control unit
 * This helps us determine if we need to qualify the variable name
 */
export function isControlUnitVariable(
  ref: Reference<NamedElement>
): [boolean, string | null] {
  const container = ref?.ref?.$container;
  return container && isControlUnit(container)
    ? [true, container.name]
    : [false, null];
}
