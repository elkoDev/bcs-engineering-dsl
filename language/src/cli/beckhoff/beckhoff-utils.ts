import { HardwareModel } from "../../language/generated/ast.js";

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
  throw new Error("No matching DALI terminals found in hardware model");
}
