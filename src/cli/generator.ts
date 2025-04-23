import { expandToNode, toString } from "langium/generate";
import { ControlModel, HardwareModel } from "../language/generated/ast.js";
import { extractDestinationAndName } from "./cli-util.js";
import * as fs from "node:fs";
import * as path from "node:path";

export function generateCodeAndConfig(
  controlModel: ControlModel,
  hardwareModel: HardwareModel,
  fileName: string,
  destination?: string
): string[] {
  const filePathData = extractDestinationAndName(fileName, destination);

  const generatedCodePath = generateCode(
    controlModel,
    filePathData.destination
  );
  const generatedConfigPath = generateConfig(
    hardwareModel,
    filePathData.destination
  );

  return [generatedCodePath, generatedConfigPath];
}

function generateCode(controlModel: ControlModel, destination: string): string {
  const fileNode = expandToNode`
    Control code for ${controlModel.controller.ref?.name}
  `.appendNewLineIfNotEmpty();

  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const generatedCodePath = `${path.join(destination, "control")}.st`;
  fs.writeFileSync(generatedCodePath, toString(fileNode));
  return generatedCodePath;
}

function generateConfig(
  hardwareModel: HardwareModel,
  destination: string
): string {
  const fileNode = expandToNode`
  Config for ${hardwareModel.controllers?.at(0)?.name ?? ""}
`.appendNewLineIfNotEmpty();

  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const generatedConfigPath = `${path.join(destination, "config")}.xml`;
  fs.writeFileSync(generatedConfigPath, toString(fileNode));
  return generatedConfigPath;
}
