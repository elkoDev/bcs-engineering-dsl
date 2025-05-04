using EnvDTE;
using EnvDTE80;
using System.Runtime.Versioning;
using TCatSysManagerLib;
using TcAutomation.Manager;

namespace TcAutomation
{
    internal class Script
    {
        private DTE2? _dte = null;
        private Solution2? _solution = null;
        private ITcSysManager4? _systemManager = null;
        private Project? _project = null;
        private PlcProjectManager? _plcProjectManager = null;

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

                _plcProjectManager = new PlcProjectManager(_systemManager, _config);
                _plcProjectManager.AddPlcProject();
                _plcProjectManager.SetTaskCycleTime(10000); // 10ms
                _plcProjectManager.AddReference("Tc3_DALI", "Beckhoff Automation GmbH");
                _plcProjectManager.CreatePlcObject("GVL_Test", PlcObjectType.GlobalVariables, "VAR_GLOBAL\r\nEND_VAR");
                _plcProjectManager.CreatePlcObject("FB_Test", PlcObjectType.FunctionBlock, "FUNCTION_BLOCK FB_Test\r\nVAR_INPUT\r\n\tInput1: BOOL;\r\nEND_VAR\r\nVAR_OUTPUT\r\n\tOutput1: BOOL;\r\n\tOutput2: BOOL;\r\nEND_VAR\r\nVAR\r\nEND_VAR\r\n", "Output1 := NOT Input1;\r\nOutput2 := Input1;");
                _plcProjectManager.CreatePlcObject("MyStruct", PlcObjectType.Struct, "TYPE MyStruct :\r\nSTRUCT\r\n\tX : REAL := 0.0;\r\n\tY : REAL := 0.0;\r\nEND_STRUCT\r\nEND_TYPE\r\n");
                _plcProjectManager.CreatePlcObject("MyEnum", PlcObjectType.Enum, "{attribute 'qualified_only'}\r\n{attribute 'strict'}\r\nTYPE MyEnum :\r\n(\r\n\tOff := 0,\r\n\tOn := 1\r\n);\r\nEND_TYPE\r\n");
                _plcProjectManager.SetMainPlcObject("PROGRAM MAIN\r\nVAR\r\n\tbRunOnlyOnce : BOOL := FALSE;\r\n\tFB_result : BOOL;\r\n\tF_result : BOOL;\r\n\ttestFB : FB_Test;\r\nEND_VAR\r\n", "IF NOT bRunOnlyOnce THEN\r\n\tADSLOGSTR(msgCtrlMask := ADSLOG_MSGTYPE_ERROR OR ADSLOG_MSGTYPE_LOG, \r\n\t\tmsgFmtStr := 'Hello %s', \r\n\t\tstrArg := 'world!');\r\n\tbRunOnlyOnce := TRUE;\r\nEND_IF\r\n\r\n\r\n// Test FB\r\ntestFB(Input1:=TRUE);\r\nFB_result := testFB.Output1;");

                _systemManager.ActivateConfiguration();
                Console.WriteLine("✅ TwinCAT configuration activated.");
                _systemManager.StartRestartTwinCAT();
                Console.WriteLine("✅ TwinCAT restarted.");

                _project.Save();
                _solution.SaveAs(Path.Combine(_config.SolutionPath, $"{_config.SolutionName}.sln"));
                Console.WriteLine("✅ TwinCAT project saved.");
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
