import { GlobalInstanceManager } from "../global-instance-manager.js";
import {
  HardwareModel,
  ControlModel,
  isFunctionBlockDecl,
} from "../../../../../language/generated/ast.js";
import { LibraryHandlerResult } from "./library-handler-manager.js";
import { getControllers } from "../../../../../language/hardware/utils/hardware-definition-utils.js";
import { getPortGroups } from "../../../../../language/hardware/utils/component-utils.js";

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

    const daliComType = DaliLibraryHandler.detectDaliComType(hardwareModel);
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

  /**
   * Checks if DALI library instances are required and adds them to the instance manager
   */
  public static addRequiredInstances(
    controlModel: ControlModel,
    hardwareModel: HardwareModel,
    instanceManager: GlobalInstanceManager
  ): void {
    // Check if any extern function block from Tc3_DALI is used
    const hasExternDaliFB = controlModel.externTypeDecls.some(
      (item) =>
        isFunctionBlockDecl(item) &&
        item.isExtern &&
        item.name.startsWith("FB_DALI")
    );
    if (!hasExternDaliFB) return;

    // Try to detect the DALI communication FB type from hardware
    const daliComType = DaliLibraryHandler.detectDaliComType(hardwareModel);
    if (!daliComType) {
      throw new Error(
        "DALI communication moduleType not found in hardware. Please declare a portgroup with a supported DALI moduleType (e.g., KL6811, KL6821, EL6821) to use FB_DALI function blocks."
      );
    }

    instanceManager.addDaliComInstance(daliComType);
  }

  private static detectDaliComType(
    hardwareModel: HardwareModel
  ): string | undefined {
    const mapping: Record<string, string> = {
      KL6811: "FB_KL6811Communication",
      KL6821: "FB_KL6821Communication",
      EL6821: "FB_EL6821Communication",
    };

    for (const ctrl of getControllers(hardwareModel)) {
      for (const portGroup of getPortGroups(ctrl)) {
        if (portGroup.module?.ref) {
          const module = portGroup.module.ref;
          if (module && mapping[module.product]) {
            return mapping[module.product];
          }
        }
      }
    }
    return undefined;
  }
}
