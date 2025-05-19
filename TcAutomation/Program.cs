using System.CommandLine;
using System.Runtime.Versioning;

namespace TcAutomation
{
    [SupportedOSPlatform("windows")]
    class Program
    {
        static int Main(string[] args)
        {
            var workspaceOption = new Option<string>(
                "--workspace", "Path to your project root (where generated/ lives)")
            { IsRequired = true };

            var solutionNameOption = new Option<string>(
                "--solution-name", () => "MyGeneratedSolution",
                "Name of the TwinCAT solution");

            var projectNameOption = new Option<string>(
                "--project-name", () => "MyTwinCATProject",
                "Name of the Visual Studio project");

            var plcNameOption = new Option<string>(
                "--plc-name", () => "MyPlcProject",
                "PLC project name");

            var templatePathOption = new Option<string>(
                "--template-path", () => @"C:\TwinCAT\3.1\Components\Base\PrjTemplate\TwinCAT Project.tsproj",
                "Path to your .tsproj template");

            var workspaceGeneratedOption = new Option<string>(
                "--workspace-generated", () => "generated",
                "Relative folder under workspace where your TS CLI wrote artifacts");

            var progIdOption = new Option<string>(
                "--prog-id", () => "TcXaeShell.DTE.15.0",
                "ProgID to use when launching TwinCAT");

            var rootCommand = new RootCommand("BCS → TwinCAT automation")
            {
                workspaceOption,
                solutionNameOption,
                projectNameOption,
                plcNameOption,
                templatePathOption,
                workspaceGeneratedOption,
                progIdOption
            };

            rootCommand.SetHandler((
                string workspace,
                string solutionName,
                string projectName,
                string plcName,
                string templatePath,
                string workspaceGenerated,
                string progId) =>
            {
                var cfg = new ScriptConfig
                {
                    SolutionName = solutionName,
                    ProjectName = projectName,
                    PlcProjectName = plcName,
                    GenerationPath = Path.Combine(workspace, workspaceGenerated),
                    TemplatePath = templatePath,
                    ProgId = progId
                };

                var script = new Script(cfg);
                script.Run();
            },
            workspaceOption,
            solutionNameOption,
            projectNameOption,
            plcNameOption,
            templatePathOption,
            workspaceGeneratedOption,
            progIdOption
            );

            return rootCommand.InvokeAsync(args).Result;
        }
    }
}
