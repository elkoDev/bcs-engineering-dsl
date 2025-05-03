using EnvDTE;
using EnvDTE80;
using System.Runtime.Versioning;
using TCatSysManagerLib;

namespace TcAutomation
{
    internal class Program
    {
        private const string ProgId = "TcXaeShell.DTE.15.0";
        private const string SolName = "MyGeneratedSolution";
        private const string PrjName = "MyTwinCATProject";

        private static readonly string SolutionPath =
            @"C:\Users\elias\mscRepos\bcs-engineering-dsl\TcAutomation\generated\" + SolName;
        private static readonly string TemplatePath =
            @"C:\TwinCAT\3.1\Components\Base\PrjTemplate\TwinCAT Project.tsproj";


        [SupportedOSPlatform("windows")]
        [STAThread]
        private static void Main()
        {
            DTE2 dte = StartHiddenDte();

            try
            {
                Solution2 sln = InitSolution(dte);
                Console.WriteLine("Solution created.");

                Project prj = AddTwinCatProject(sln);
                Console.WriteLine("Project added from template.");

                ITcSysManager4 sysMan = (ITcSysManager4)prj.Object;


                sysMan.ActivateConfiguration();
                sysMan.StartRestartTwinCAT();

                prj.Save();
                sln.SaveAs(Path.Combine(SolutionPath, $"{SolName}.sln"));

                Console.WriteLine("✅ TwinCAT configuration generated successfully.");
            }
            finally
            {
                dte.Quit();
                MessageFilter.Revoke();
            }
        }

        [SupportedOSPlatform("windows")]
        private static DTE2 StartHiddenDte()
        {
            Type? dteType = Type.GetTypeFromProgID(ProgId, throwOnError: true);
            var dte = (DTE2)Activator.CreateInstance(dteType!, true)!;

            if (!MessageFilter.IsRegistered) MessageFilter.Register();

            // run headless
            dte.SuppressUI = true;
            dte.MainWindow.Visible = false;
            dte.UserControl = false;

            return dte;
        }

        private static Solution2 InitSolution(DTE2 dte)
        {
            Directory.CreateDirectory(SolutionPath);

            var sln = (Solution2)dte.Solution;
            sln.Create(SolutionPath, SolName);
            sln.SaveAs(Path.Combine(SolutionPath, $"{SolName}.sln"));

            return sln;
        }

        private static Project AddTwinCatProject(Solution2 sln)
        {
            if (!File.Exists(TemplatePath))
                throw new FileNotFoundException("TwinCAT template not found.", TemplatePath);

            Project prj = sln.AddFromTemplate(TemplatePath, SolutionPath, PrjName, Exclusive: false);

            return prj;
        }
    }
}
