import type {
  ControlModel,
  HardwareModel,
} from "../../language/generated/ast.js";
import { generate as genBeckhoff } from "./beckhoff/generate.js";
import { deploy as depBeckhoff } from "./beckhoff/deploy.js";
//import { generate as genSiemens } from "./siemens/generator.js";
//import { deploy as depSiemens } from "./siemens/deploy.js";
//import { generate as genKnx } from "./knx/generator.js";
//import { deploy as depKnx } from "./knx/deploy.js";

export type Platform = "Beckhoff" | "Siemens" | "KNX";

export interface GenerateResult {
  files: string[];
  // …any other metadata…
}

export interface DeployOptions {
  workspace: string;
  // Beckhoff‐specific:
  solutionName: string;
  projectName: string;
  plcName: string;
  templatePath?: string;
  tcExe?: string;
  adsUsername?: string;
  adsPassword?: string;
  // Siemens/KNX could have their options here
}

export function generateFor(
  platform: Platform,
  control: ControlModel,
  hardware: HardwareModel,
  destination: string
): GenerateResult {
  switch (platform) {
    case "Beckhoff":
      return genBeckhoff(control, hardware, destination);
    case "Siemens":
      throw new Error("Siemens generation not implemented yet");
    //return genSiemens(control, hardware, destination);
    case "KNX":
      throw new Error("KNX generation not implemented yet");
    //return genKnx(control, hardware, destination);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export function deployTo(platform: Platform, opts: DeployOptions): void {
  switch (platform) {
    case "Beckhoff":
      return depBeckhoff(opts);
    case "Siemens":
      throw new Error("Siemens deployment not implemented yet");
    //return depSiemens(opts);
    case "KNX":
      throw new Error("KNX deployment not implemented yet");
    //return depKnx(opts);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
