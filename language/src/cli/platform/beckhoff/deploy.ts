import which from "which";
import { spawnSync } from "child_process";
import chalk from "chalk";

import type { DeployOptions } from "../index.js";

export function deploy(opts: DeployOptions) {
  const exe = opts.tcExe ?? "TcAutomation.exe";
  let tcPath: string;
  try {
    tcPath = which.sync(exe);
  } catch {
    console.error(chalk.red(`❌ Cannot find ${exe} in your PATH.`));
    process.exit(1);
  }

  const args = [
    "--workspace",
    opts.workspace,
    "--solution-name",
    opts.solutionName,
    "--project-name",
    opts.projectName,
    "--plc-name",
    opts.plcName,
    "--template-path",
    opts.templatePath,
  ].filter((arg): arg is string => typeof arg === "string");

  console.log(chalk.gray(`[beckhoff] ${tcPath} ${args.join(" ")}`));
  const res = spawnSync(tcPath, args, { stdio: "inherit" });
  if (res.error || res.status !== 0) {
    console.error(chalk.red("❌ Beckhoff automation failed."));
    process.exit(res.status ?? 1);
  }
  console.log(chalk.green("✅ Beckhoff deployment complete."));
}
