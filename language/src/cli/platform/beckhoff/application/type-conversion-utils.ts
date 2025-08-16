import { isPrimary, TypeRef } from "../../../../language/generated/ast.js";

/**
 * Utility for converting DSL type references to IEC 61131-3 Structured Text type notation
 */
export class TypeConverter {
  /**
   * Converts TypeRef to Structured Text type notation
   */
  static convertTypeRefToST(typeRef: TypeRef): string {
    if (typeRef.type) {
      if (typeRef.sizes.length === 0) {
        return typeRef.type;
      } else {
        return `ARRAY [${typeRef.sizes
          .map((size) => {
            if (isPrimary(size) && typeof size.val === "number") {
              return `0..${size.val - 1}`;
            }
            return "0..?";
          })
          .join(", ")}] OF ${typeRef.type}`;
      }
    } else if (typeRef.ref) {
      const typeDecl = typeRef.ref.ref;
      const typeName =
        typeDecl && "name" in typeDecl ? typeDecl.name : "UNKNOWN";
      if (typeRef.sizes.length === 0) {
        return typeName as string;
      } else {
        return `ARRAY [${typeRef.sizes
          .map((size) => {
            if (isPrimary(size) && typeof size.val === "number") {
              return `0..${size.val - 1}`;
            }
            return "0..?";
          })
          .join(", ")}] OF ${typeName}`;
      }
    }
    return "UNKNOWN_TYPE";
  }
}
