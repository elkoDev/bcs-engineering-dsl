import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { defineBeckhoffSubcommands } from "./platform/beckhoff/cli.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "../../package.json"), "utf-8")
);

export default function () {
  const program = new Command();
  program.version(pkg.version);

  program.addCommand(defineBeckhoffSubcommands());
  // program.addCommand(defineSiemensSubcommands());
  // program.addCommand(defineKnxSubcommands());

  program.parse();
}
