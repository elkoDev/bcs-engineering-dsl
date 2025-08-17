import { GlobalInstanceManager } from "../global-instance-manager.js";
import { HardwareModel } from "../../../../../language/generated/ast.js";
import { detectDaliComType } from "../../utils.js";
import { LibraryHandlerResult } from "./library-handler-manager.js";

/**
 * Handles DALI-specific function block instantiation logic
 */
export class DaliLibraryHandler {
  public static handle(
    fbType: string,
    inputMappings: string,
    instanceManager: GlobalInstanceManager,
    hardwareModel: HardwareModel
  ): LibraryHandlerResult | null {
    if (!fbType.startsWith("FB_DALI")) {
      return null;
    }

    const daliComType = detectDaliComType(hardwareModel);
    if (!daliComType) {
      throw new Error(
        "DALI communication moduleType not found in hardware. Please declare a portgroup with a supported DALI moduleType (e.g., KL6811, KL6821, EL6821) to use FB_DALI function blocks."
      );
    }

    const daliComInstance = instanceManager.getDaliComInstance(daliComType);
    if (!daliComInstance) {
      throw new Error("DALI communication FB instance was not generated.");
    }

    return {
      inputMappings,
      constructorArgs: daliComInstance.instanceName,
    };
  }
}
