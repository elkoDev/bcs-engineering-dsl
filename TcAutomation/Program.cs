using System.Runtime.Versioning;

namespace TcAutomation
{
    public class Program
    {
        [SupportedOSPlatform("windows")]
        [STAThread]
        private static void Main()
        {
            ScriptConfig config = new()
            {
                ProgId = "TcXaeShell.DTE.15.0",
                SolutionName = "MyGeneratedSolution",
                ProjectName = "MyTwinCATProject",
                PlcProjectName = "MyPlcProject",
                GenerationPath = @"C:\Users\elias\mscRepos\bcs-engineering-dsl\TcAutomation\generated\",
                TemplatePath = @"C:\TwinCAT\3.1\Components\Base\PrjTemplate\TwinCAT Project.tsproj",
                VsXaePlcEmptyTemplateName = "Standard PLC Template.plcproj"
            };

            Script script = new(config);
            script.Run();
        }
    }
}
