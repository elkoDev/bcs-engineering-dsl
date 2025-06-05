import path from "node:path";
import chalk from "chalk";
import { generateAction } from "./generate.js";
import { deployTo, Platform } from "../platform/index.js";

export async function deployAction(
  platform: Platform,
  file: string,
  opts: {
    destination?: string;
    quiet: boolean;
    templatePath?: string;
    tcExe?: string;
    solutionName: string;
    projectName: string;
    plcName: string;
    adsUsername?: string;
    adsPassword?: string;
  }
) {
  // 1) generate
  await generateAction(platform, file, {
    destination: opts.destination,
    quiet: opts.quiet,
  });
  // 2) deploy
  console.log(chalk.blue(`\nDeploying to ${platform}…`));
  deployTo(platform, {
    workspace: path.dirname(path.resolve(file)),
    templatePath: opts.templatePath,
    tcExe: opts.tcExe,
    solutionName: opts.solutionName,
    projectName: opts.projectName,
    plcName: opts.plcName,
    adsUsername: opts.adsUsername,
    adsPassword: opts.adsPassword,
  });
}
