import chalk from "chalk";
import { Command } from "commander";
import { createBcsEngineeringServices } from "../language/bcs-engineering-module.js";
import { generateArtifacts } from "./generator.js";
import { NodeFileSystem } from "langium/node";
import * as url from "node:url";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { BCSControlLanguageMetaData } from "../language/generated/module.js";
import { extractControlModelWithHardwareModels } from "./cli-util.js";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const packagePath = path.resolve(__dirname, "..", "..", "package.json");
const packageContent = await fs.readFile(packagePath, "utf-8");

export const generateAction = async (
  fileName: string,
  opts: GenerateOptions
): Promise<void> => {
  const services = createBcsEngineeringServices(NodeFileSystem).bcsControl;
  const [controlModel, hardwareModels] =
    await extractControlModelWithHardwareModels(fileName, services);
  const generatedFilePaths = generateArtifacts(
    controlModel,
    hardwareModels[0],
    fileName,
    opts.destination
  );
  console.log(
    chalk.green(`Control code & config generated successfully `),
    chalk.blue("✓\n"),
    chalk.magenta(
      generatedFilePaths.map((filePath) => "\t• " + filePath).join("\n")
    )
  );
};

export type GenerateOptions = {
  destination?: string;
  root?: string;
  quiet: boolean;
};

export default function (): void {
  const program = new Command();

  program.version(JSON.parse(packageContent).version);

  const fileExtensions = BCSControlLanguageMetaData.fileExtensions.join(", ");
  program
    .command("generate")
    .argument(
      "<file>",
      `source file (possible file extensions: ${fileExtensions})`
    )
    .option("-d, --destination <dir>", "destination directory of generating")
    .option("-r, --root <dir>", "source root folder")
    .option("-q, --quiet", "whether the program should print something", false)
    .description(
      "Generates control code & configuration from a BCS Control file in the workspace."
    )
    .action(generateAction);

  program.parse(process.argv);
}
