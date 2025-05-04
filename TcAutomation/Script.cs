using EnvDTE;
using EnvDTE80;
using System.Runtime.Versioning;
using TCatSysManagerLib;

namespace TcAutomation
{
    public class Script
    {
        private DTE2? _dte = null;
        private Solution2? _solution = null;
        private ITcSysManager4? _systemManager = null;
        private Project? _project = null;

        private const string ProgId = "TcXaeShell.DTE.15.0";
        private const string SolutionName = "MyGeneratedSolution";
        private const string ProjectName = "MyTwinCATProject";

        private static readonly string SolutionPath =
            @"C:\Users\elias\mscRepos\bcs-engineering-dsl\TcAutomation\generated\" + SolutionName;
        private static readonly string TemplatePath =
            @"C:\TwinCAT\3.1\Components\Base\PrjTemplate\TwinCAT Project.tsproj";

        [SupportedOSPlatform("windows")]
        public Script()
        {
            OnInitialize();
        }

        ~Script()
        {
            OnDestruct();
        }

        [SupportedOSPlatform("windows")]
        private void OnInitialize()
        {
            _dte = StartHiddenDte();
        }

        private void OnDestruct()
        {
            _dte?.Quit();
            MessageFilter.Revoke();
        }

        public void Run()
        {
            try
            {
                _solution = InitSolution(_dte!);

                _project = AddTwinCatProject(_solution!);

                _systemManager = (ITcSysManager4)_project!.Object;

                _systemManager.ActivateConfiguration();
                _systemManager.StartRestartTwinCAT();

                _project.Save();
                _solution.SaveAs(Path.Combine(SolutionPath, $"{SolutionName}.sln"));

                Console.WriteLine("✅ TwinCAT configuration generated successfully.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error: {ex.Message}");
            }
        }

        [SupportedOSPlatform("windows")]
        private DTE2 StartHiddenDte()
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


        private Solution2 InitSolution(DTE2 dte)
        {
            DeleteSolutionFolder();
            Directory.CreateDirectory(SolutionPath);

            var sln = (Solution2)dte.Solution;
            sln.Create(SolutionPath, SolutionName);
            sln.SaveAs(Path.Combine(SolutionPath, $"{SolutionName}.sln"));

            Console.WriteLine("Solution created.");

            return sln;
        }

        private bool DeleteSolutionFolder()
        {
            if (Directory.Exists(SolutionPath))
            {
                Directory.Delete(SolutionPath, true);
                return true;
            }
            return false;
        }

        private Project AddTwinCatProject(Solution2 sln)
        {
            if (!File.Exists(TemplatePath))
                throw new FileNotFoundException("TwinCAT template not found.", TemplatePath);

            Project prj = sln.AddFromTemplate(TemplatePath, SolutionPath, ProjectName, Exclusive: false);

            Console.WriteLine("Project added from template.");

            return prj;
        }
    }
}
