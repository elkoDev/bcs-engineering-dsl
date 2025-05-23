using EnvDTE;
using EnvDTE80;
using TCatSysManagerLib;
using TcAutomation.Manager.Io;
using TcAutomation.Script;

namespace TcAutomation.Manager.System
{
    internal class SystemProjectManager
    {
        private ITcSysManager4 _systemManager;
        private readonly ScriptConfig _config;
        private readonly DTE2 _dte;

        public SystemProjectManager(ITcSysManager4 systemManager, ScriptConfig config, DTE2 dte)
        {
            _systemManager = systemManager;
            _config = config;
            _dte = dte;
        }

        /// <summary>
        /// Builds the solution before linking to ensure all PLC instance variables are recognized.
        /// </summary>
        private bool BuildProject()
        {
            _dte.Solution.SolutionBuild.Build(true);

            vsBuildState state = _dte.Solution.SolutionBuild.BuildState;
            bool buildSucceeded = (_dte.Solution.SolutionBuild.LastBuildInfo == 0
                                   && state == vsBuildState.vsBuildStateDone);
            return buildSucceeded;
        }

        public void LinkVariables(HardwareConfig hw)
        {
            Task.Run(() => WindowHelper.WaitAndCloseTcShellPopup());
            BuildProject();

            foreach (var mapping in hw.VariableMappings)
            {
                string ioDirectionString = $"{mapping.Direction}s";
                string source = $"{TcShortcut.TIPC.GetShortcutKey()}^{_config.PlcProjectName}^{_config.PlcProjectName} Instance^MainPlcTask {ioDirectionString}^Main.{mapping.PlcVar}";
                string destination = $"{TcShortcut.TIID.GetShortcutKey()}^Device 1 ({mapping.Bus})^{mapping.Box}^Term {mapping.ModuleSlot} ({mapping.ModuleProduct})^{mapping.Link}";

                _systemManager.LinkVariables(source, destination);
                Console.WriteLine($"\t- Linked {mapping.PlcVar} to {mapping.Link} on {mapping.Bus} - {mapping.Box} - {mapping.ModuleProduct} - Slot {mapping.ModuleSlot}");
            }

            Console.WriteLine($"✅ Variables linked to hardware configuration.");
        }
    }
}
