namespace TcAutomation.Script
{    public class ScriptConfig
    {
        public required string SolutionName { get; set; }
        public required string ProjectName { get; set; }
        public required string PlcProjectName { get; set; }
        public required string GenerationPath { get; set; }
        public required string TemplatePath { get; set; }
        public string ProgId { get; set; } = "TcXaeShell.DTE.15.0";
        public string AdsUsername { get; set; } = "Administrator";
        public string AdsPassword { get; set; } = "1";

        public string SolutionPath => Path.Combine(GenerationPath, SolutionName);
        public string VsXaePlcEmptyTemplateName { get; set; } = "Standard PLC Template.plcproj";
    }

}
