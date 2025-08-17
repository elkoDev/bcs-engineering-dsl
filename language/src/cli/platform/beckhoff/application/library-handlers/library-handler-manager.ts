import { GlobalInstanceManager } from "../global-instance-manager.js";
import { HardwareModel } from "../../../../../language/generated/ast.js";
import { DaliLibraryHandler } from "./dali-library-handler.js";

export interface LibraryHandlerResult {
  inputMappings: string;
  constructorArgs?: string;
}

/**
 * Coordinates handling of special library-specific function block logic
 */
export class LibraryHandlerManager {
  private static readonly handlers = [DaliLibraryHandler];

  public static handleLibrarySpecials(
    fbType: string,
    inputMappings: string,
    instanceManager: GlobalInstanceManager,
    hardwareModel: HardwareModel
  ): LibraryHandlerResult {
    for (const Handler of this.handlers) {
      const result = Handler.handle(
        fbType,
        inputMappings,
        instanceManager,
        hardwareModel
      );
      if (result) {
        return result;
      }
    }

    return { inputMappings };
  }
}
