using EnvDTE;
using EnvDTE80;
using TCatSysManagerLib;
using TcAutomation.Helper;
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
        }        public void LinkVariables(HardwareConfig hw)
        {
            Task.Run(() => WindowHelper.WaitAndCloseTcShellPopup());
            BuildProject();

            foreach (var mapping in hw.VariableMappings)
            {
                string ioDirectionString = $"{mapping.Direction}s";
                string source = $"{TcShortcut.TIPC.GetShortcutKey()}^{_config.PlcProjectName}^{_config.PlcProjectName} Instance^MainPlcTask {ioDirectionString}^Main.{mapping.PlcVar}";
                
                // Discover the actual device structure instead of hardcoding names
                string destination = FindIoDestinationPath(mapping);

                _systemManager.LinkVariables(source, destination);
                Console.WriteLine($"\t- Linked {mapping.PlcVar} to {destination}");
            }

            Console.WriteLine($"✅ Variables linked to hardware configuration.");
        }

        /// <summary>
        /// Discovers the actual TwinCAT device structure to build correct I/O paths
        /// </summary>
        private string FindIoDestinationPath(VariableMapping mapping)
        {
            var ioRoot = _systemManager.LookupTreeItem(TcShortcut.TIID.GetShortcutKey());            // Find the device that matches the bus configuration
            ITcSmTreeItem device = null!;
            for (int i = 1; i <= ioRoot.ChildCount; i++)
            {
                var child = ioRoot.Child[i];
                if (child.ItemType == 2) // Device type
                {
                    // For now, take the first device - could be enhanced to match by controller type
                    device = child;
                    break;
                }
            }

            if (device == null)
            {
                throw new InvalidOperationException("No I/O device found in TwinCAT project");
            }

            // Find the box (terminal coupler)
            ITcSmTreeItem box = null;
            for (int i = 1; i <= device.ChildCount; i++)
            {
                var child = device.Child[i];
                if (child.ItemType == 5) // Box type
                {
                    box = child;
                    break;
                }
            }

            if (box == null)
            {
                throw new InvalidOperationException($"No terminal coupler box found in device {device.Name}");
            }

            // Build the destination path using actual TwinCAT names
            string destination = $"{TcShortcut.TIID.GetShortcutKey()}^{device.Name}^{box.Name}^Term {mapping.ModuleSlot} ({mapping.ModuleProduct})^{mapping.Link}";
            
            return destination;
        }
    }
}
