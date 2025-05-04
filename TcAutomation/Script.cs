using EnvDTE;
using EnvDTE80;
using System.Runtime.Versioning;
using TCatSysManagerLib;

namespace TcAutomation
{
    internal class Script
    {
        private DTE2? _dte = null;
        private Solution2? _solution = null;
        private ITcSysManager4? _systemManager = null;
        private Project? _project = null;

        private readonly ScriptConfig _config;

        [SupportedOSPlatform("windows")]
        public Script(ScriptConfig config)
        {
            _config = config;
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
                _solution.SaveAs(Path.Combine(_config.SolutionPath, $"{_config.SolutionName}.sln"));

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
            Type? dteType = Type.GetTypeFromProgID(_config.ProgId, throwOnError: true);
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
            Directory.CreateDirectory(_config.SolutionPath);

            var sln = (Solution2)dte.Solution;
            sln.Create(_config.SolutionPath, _config.SolutionName);
            sln.SaveAs(Path.Combine(_config.SolutionPath, $"{_config.SolutionName}.sln"));

            Console.WriteLine("Solution created.");

            return sln;
        }

        private bool DeleteSolutionFolder()
        {
            if (Directory.Exists(_config.SolutionPath))
            {
                Directory.Delete(_config.SolutionPath, true);
                return true;
            }
            return false;
        }

        private Project AddTwinCatProject(Solution2 sln)
        {
            if (!File.Exists(_config.TemplatePath))
                throw new FileNotFoundException("TwinCAT template not found.", _config.TemplatePath);

            Project prj = sln.AddFromTemplate(_config.TemplatePath, _config.SolutionPath, _config.ProjectName, Exclusive: false);

            Console.WriteLine("Project added from template.");

            return prj;
        }
    }
}
