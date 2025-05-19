import { NodeFileSystem } from "langium/node";
import { createBcsEngineeringServices } from "../../language/bcs-engineering-module.js";
import {
  extractControlModelWithHardwareModels,
  extractDestinationAndName,
} from "../cli-util.js";
import { generateFor, Platform } from "../platform/index.js";
import chalk from "chalk";

export async function generateAction(
  platform: Platform,
  file: string,
  opts: { destination?: string; quiet: boolean }
) {
  const services = createBcsEngineeringServices(NodeFileSystem).bcsControl;
  const [control, hwModels] = await extractControlModelWithHardwareModels(
    file,
    services
  );
  if (!platform) throw new Error("No target platform in control model.");

  const { destination } = extractDestinationAndName(file, opts.destination);
  const { files } = generateFor(platform, control, hwModels[0], destination);

  if (!opts.quiet) {
    console.log(chalk.green(`Generated for ${platform}:`));
    files.forEach((f) => console.log("  •", f));
  }
}
