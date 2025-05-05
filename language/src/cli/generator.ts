import { expandToNode, toString } from "langium/generate";
import { ControlModel, HardwareModel } from "../language/generated/ast.js";
import { extractDestinationAndName } from "./cli-util.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { generatePlcObjects } from "./plc-object-generator.js";
import { generateBeckhoffArtifacts } from "./beckhoff/beckhoff-generator.js";

export function generateArtifacts(
  controlModel: ControlModel,
  hardwareModel: HardwareModel,
  fileName: string,
  destination?: string
): string[] {
  const filePathData = extractDestinationAndName(fileName, destination);

  const targetPlatform = controlModel.controlBlock.controller.ref?.platform;
  if (!targetPlatform) {
    throw new Error("Target platform not found in control model.");
  }

  switch (targetPlatform) {
    case "Siemens":
      // Add Siemens specific code generation logic here
      break;
    case "Beckhoff":
      return generateBeckhoffArtifacts(
        controlModel,
        hardwareModel,
        filePathData.destination
      );
    case "KNX":
      // Add KNX specific code generation logic here
      break;
    default:
      throw new Error(`Unsupported target platform: ${targetPlatform}`);
  }

  return [];
}
