namespace TcAutomation
{
    public class ScriptConfig
    {
        public required string ProgId { get; set; }
        public required string SolutionName { get; set; }
        public required string ProjectName { get; set; }
        public required string PlcProjectName { get; set; }
        public required string GenerationPath { get; set; }
        public string SolutionPath
        {
            get { return GenerationPath + SolutionName; }
        }
        public required string TemplatePath { get; set; }
        public required string VsXaePlcEmptyTemplateName = "Empty PLC Template.plcproj";

        public ScriptConfig() { }
    }
}
