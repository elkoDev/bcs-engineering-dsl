import { Command } from "commander";
import { Platform } from "../index.js";
import { deployAction } from "../../commands/deploy.js";
import { generateAction } from "../../commands/generate.js";

export function defineBeckhoffSubcommands(): Command {
  const beckhoff = new Command("beckhoff").description("Beckhoff automation");
  const platform = "Beckhoff" as Platform;

  beckhoff
    .command("generate")
    .argument("<file>", "BCS control file")
    .option("-d, --destination <dir>")
    .option("-q, --quiet", "suppress output", false)
    .action(async (file, opts) => {
      await generateAction(platform, file, {
        destination: opts.destination,
        quiet: opts.quiet,
      });
    });
  beckhoff
    .command("deploy")
    .argument("<file>", "BCS control file")
    .option("--template-path <path>", "TwinCAT Template path")
    .option("--solution-name <name>", "Solution name", "MyGeneratedSolution")
    .option("--project-name <name>", "Project name", "MyTwinCATProject")
    .option("--plc-name <name>", "PLC project", "MyPlcProject")
    .option("--tc-exe <path>", "TcAutomation exe")
    .option(
      "--ads-username <username>",
      "ADS username for remote connection",
      "Administrator"
    )
    .option(
      "--ads-password <password>",
      "ADS password for remote connection",
      "1"
    )
    .option("-d, --destination <dir>")
    .option("-q, --quiet", "suppress output", false)
    .action(async (file, opts) => {
      await deployAction(platform, file, {
        templatePath: opts.templatePath,
        solutionName: opts.solutionName,
        projectName: opts.projectName,
        plcName: opts.plcName,
        tcExe: opts.tcExe,
        adsUsername: opts.adsUsername,
        adsPassword: opts.adsPassword,
        destination: opts.destination,
        quiet: opts.quiet,
      });
    });

  return beckhoff;
}
