using System.CommandLine;
using System.Runtime.Versioning;
using TcAutomation.Script;

namespace TcAutomation
{
    public class AutomationOptions
    {
        public string Workspace { get; set; }
        public string SolutionName { get; set; }
        public string ProjectName { get; set; }
        public string PlcName { get; set; }
        public string TemplatePath { get; set; }
        public string WorkspaceGenerated { get; set; }
        public string ProgId { get; set; }
        public string AdsUsername { get; set; }
        public string AdsPassword { get; set; }
    }


    [SupportedOSPlatform("windows")]
    class Program
    {
        [STAThread]
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

            var progIdOption = new Option<string>(
                "--prog-id", () => "TcXaeShell.DTE.15.0",
                "ProgID to use when launching TwinCAT");

            var adsUsernameOption = new Option<string>(
                "--ads-username", () => "Administrator",
                "ADS username for remote connection");

            var adsPasswordOption = new Option<string>(
                "--ads-password", () => "1",
                "ADS password for remote connection");

            var rootCommand = new RootCommand("BCS → TwinCAT automation")
            {
                workspaceOption,
                solutionNameOption,
                projectNameOption,
                plcNameOption,
                templatePathOption,
                progIdOption,
                adsUsernameOption,
                adsPasswordOption
            }; rootCommand.SetHandler((
                string workspace,
                string solutionName,
                string projectName,
                string plcName,
                string templatePath,
                string progId,
                string adsUsername,
                string adsPassword) =>
            {
                var cfg = new ScriptConfig
                {
                    SolutionName = solutionName,
                    ProjectName = projectName,
                    PlcProjectName = plcName,
                    GenerationPath = Path.Combine(workspace, "generated"),
                    TemplatePath = templatePath,
                    ProgId = progId,
                    AdsUsername = adsUsername,
                    AdsPassword = adsPassword
                };

                using var script = new ExecutableScript(cfg);
                script.Run();
            },
            workspaceOption,
            solutionNameOption,
            projectNameOption,
            plcNameOption,
            templatePathOption,
            progIdOption,
            adsUsernameOption,
            adsPasswordOption
            );

            return rootCommand.InvokeAsync(args).Result;
        }
    }
}
