namespace TcAutomation
{
    public class ScriptConfig
    {
        public string ProgId = "TcXaeShell.DTE.15.0";
        public string SolutionName = "MyGeneratedSolution";
        public string ProjectName = "MyTwinCATProject";
        public string GenerationPath = @"C:\Users\elias\mscRepos\bcs-engineering-dsl\TcAutomation\generated\";
        public string SolutionPath
        {
            get { return GenerationPath + SolutionName; }
        }
        public string TemplatePath =
            @"C:\TwinCAT\3.1\Components\Base\PrjTemplate\TwinCAT Project.tsproj";

        public ScriptConfig() { }
    }
}
