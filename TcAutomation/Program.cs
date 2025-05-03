using TCatSysManagerLib;

namespace TcAutomation
{
    internal class Program
    {
        static void Main(string[] args)
        {
            // Initialize Visual Studio and Create the Solution
            Type t = System.Type.GetTypeFromProgID("TcXaeShell.DTE.15.0");
            EnvDTE.DTE dte = (EnvDTE.DTE)System.Activator.CreateInstance(t);

            dte.SuppressUI = false;
            dte.MainWindow.Visible = true;

            string solutionPath = @"C:\Users\elias\mscRepos\bcs-engineering-dsl\TcAutomation\generated\MyGeneratedSolution";
            string templatePath = @"C:\TwinCAT\3.1\Components\Base\PrjTemplate\TwinCAT Project.tsproj";

            Directory.CreateDirectory(solutionPath);

            dynamic solution = dte.Solution;
            solution.Create(solutionPath, "MyGeneratedSolution");
            solution.SaveAs(Path.Combine(solutionPath, "MyGeneratedSolution.sln"));


            // Add a TwinCAT Project from Template
            dynamic project = solution.AddFromTemplate(templatePath, solutionPath, "MyTwinCATProject");
            ITcSysManager sysManager = project.Object;
        }
    }
}
