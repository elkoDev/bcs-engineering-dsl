using EnvDTE;
using EnvDTE80;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Text.Json;
using TCatSysManagerLib;
using TcAutomation.Manager.Ads;
using TcAutomation.Manager.Io;
using TcAutomation.Manager.Plc;
using TcAutomation.Manager.System;

namespace TcAutomation.Script
{
    internal class ExecutableScript : IDisposable
    {
        private DTE2? _dte = null;
        private Solution2? _solution = null;
        private ITcSysManager4? _systemManager = null;
        private Project? _project = null;
        private PlcProjectManager? _plcProjectManager = null;
        private IoProjectManager? _ioProjectManager = null;
        private HardwareConfig? _hardwareConfig = null;
        private SystemProjectManager? _systemProjectManager = null;
        private AdsManager? _adsManager = null;
        private readonly ScriptConfig _config;

        [SupportedOSPlatform("windows")]
        public ExecutableScript(ScriptConfig config)
        {
            _config = config;
            OnInitialize();
        }

        [SupportedOSPlatform("windows")]
        ~ExecutableScript()
        {
            OnDestruct();
        }

        [SupportedOSPlatform("windows")]
        private void OnInitialize()
        {
            _dte = StartHiddenDte();
        }

        [SupportedOSPlatform("windows")]
        private void OnDestruct()
        {
            try
            {
                _dte?.Quit();
            }
            catch
            {
                /* ignore errors on quit */
            }

            if (_dte != null)
            {
                Marshal.FinalReleaseComObject(_dte);
            }

            if (MessageFilter.IsRegistered)
            {
                MessageFilter.Revoke();
            }

            _dte = null;
            _solution = null;
            _systemManager = null;
            _project = null;
            _plcProjectManager = null;
            _ioProjectManager = null;
        }

        public void Run()
        {
            try
            {
                _solution = InitSolution(_dte!);

                _project = AddTwinCatProject(_solution!);

                _systemManager = (ITcSysManager4)_project!.Object;

                _systemProjectManager = new SystemProjectManager(_systemManager!, _config, _dte!);

                // Load files dynamically from generation path
                var generatedDir = new DirectoryInfo(_config.GenerationPath);
                if (!generatedDir.Exists) throw new DirectoryNotFoundException("Generated directory not found.");
                string tcConfigJsonPath = Path.Combine(generatedDir.FullName, "tc-config.json");
                if (!File.Exists(tcConfigJsonPath))
                    throw new FileNotFoundException("tc-config.json missing.");

                // Setup PLC Project
                _plcProjectManager = new PlcProjectManager(_systemManager, _config);
                _plcProjectManager.AddPlcProject();

                // Add references
                _hardwareConfig = JsonSerializer.Deserialize<HardwareConfig>(
                    File.ReadAllText(tcConfigJsonPath), new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    }
                ) ?? throw new InvalidDataException("tc-config.json invalid or empty");
                _plcProjectManager.AddReference("Tc2_Utilities");
                foreach (var lib in _hardwareConfig.Libraries)
                {
                    _plcProjectManager.AddReference(lib.Name, lib.Vendor);
                }

                // Create Enums
                var enumsDir = new DirectoryInfo(Path.Combine(generatedDir.FullName, "Enums"));
                if (enumsDir.Exists)
                {
                    foreach (var file in enumsDir.GetFiles("*.st"))
                    {
                        string code = File.ReadAllText(file.FullName);
                        _plcProjectManager.CreatePlcObject(Path.GetFileNameWithoutExtension(file.Name), PlcObjectType.Enum, code);
                    }
                }

                // Create Structs
                var structsDir = new DirectoryInfo(Path.Combine(generatedDir.FullName, "Structs"));
                if (structsDir.Exists)
                {
                    foreach (var file in structsDir.GetFiles("*.st"))
                    {
                        string code = File.ReadAllText(file.FullName);
                        _plcProjectManager.CreatePlcObject(Path.GetFileNameWithoutExtension(file.Name), PlcObjectType.Struct, code);
                    }
                }

                // Create Function Blocks
                var fbDir = new DirectoryInfo(Path.Combine(generatedDir.FullName, "FunctionBlocks"));
                if (fbDir.Exists)
                {
                    var fbGroups = fbDir.GetFiles("*_decl.st")
                        .Select(f => new
                        {
                            Decl = f,
                            Impl = fbDir.GetFiles($"{Path.GetFileNameWithoutExtension(f.Name).Replace("_decl", "_impl")}.st").FirstOrDefault()
                        });

                    foreach (var fb in fbGroups)
                    {
                        string fbName = Path.GetFileNameWithoutExtension(fb.Decl.Name).Replace("_decl", "");
                        string decl = File.ReadAllText(fb.Decl.FullName);
                        string? impl = fb.Impl != null ? File.ReadAllText(fb.Impl.FullName) : null;
                        _plcProjectManager.CreatePlcObject(fbName, PlcObjectType.FunctionBlock, decl, impl);
                    }
                }

                // Set MAIN program
                string mainDeclPath = Path.Combine(generatedDir.FullName, "MAIN_decl.st");
                string mainImplPath = Path.Combine(generatedDir.FullName, "MAIN_impl.st");
                if (!File.Exists(mainDeclPath) || !File.Exists(mainImplPath))
                    throw new FileNotFoundException("MAIN_decl.st or MAIN_impl.st missing.");

                _plcProjectManager.SetMainPlcObject(File.ReadAllText(mainDeclPath), File.ReadAllText(mainImplPath));

                // Link Task
                _plcProjectManager.LinkPlcInstanceWithTask();
                //_plcProjectManager.SetTaskCycleTime(11000); // 11ms

                // Setup ADS route
                _adsManager = new AdsManager(_systemManager);
                _adsManager.SetupAdsRoute(_hardwareConfig.Network, _config.AdsUsername, _config.AdsPassword);

                // Setup IO Project
                _ioProjectManager = new IoProjectManager(_systemManager);
                _ioProjectManager.CreateIoFromHardwareConfig(_hardwareConfig!);

                // Link Variables
                _systemProjectManager.LinkVariables(_hardwareConfig!);

                // Activate configuration and restart TwinCAT
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

            dte.SuppressUI = true;
            dte.MainWindow.Visible = false;
            dte.UserControl = false;

            return dte;
        }

        private Solution2 InitSolution(DTE2 dte)
        {
            DeleteSolutionFolder();
            Directory.CreateDirectory(_config.SolutionPath);

            if (!MessageFilter.IsRegistered) MessageFilter.Register();

            var sln = (Solution2)dte.Solution;
            sln.Create(_config.SolutionPath, _config.SolutionName);
            sln.SaveAs(Path.Combine(_config.SolutionPath, $"{_config.SolutionName}.sln"));

            Console.WriteLine("✅ Solution created.");

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


        [SupportedOSPlatform("windows")]
        public void Dispose()
        {
            OnDestruct();
            GC.SuppressFinalize(this);
        }
    }
}
