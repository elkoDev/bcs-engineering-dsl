using TCatSysManagerLib;
using TcAutomation.Manager.Io;
using TcAutomation.Script;

namespace TcAutomation.Manager.System
{
    internal class SystemProjectManager
    {
        private ITcSysManager4 _systemManager;
        private readonly ScriptConfig _config;

        public SystemProjectManager(ITcSysManager4 systemManager, ScriptConfig config)
        {
            _systemManager = systemManager;
            _config = config;
        }

        public void LinkVariables(HardwareConfig hw)
        {
            foreach (var mapping in hw.VariableMappings)
            {
                string ioDirectionString = $"{mapping.Direction}s";
                string source = $"{TcShortcut.TIPC.GetShortcutKey()}^{_config.PlcProjectName}^{_config.PlcProjectName} Instance^MainPlcTask {ioDirectionString}^Main.{mapping.PlcVar}";
                string destination = $"{TcShortcut.TIID.GetShortcutKey()}^Device 1 ({mapping.Bus})^{mapping.Box}^Term {mapping.ModuleSlot} ({mapping.ModuleProduct})^Channel {mapping.ChannelIndex}";
                //var treeItem = _systemManager.LookupTreeItem($"{TcShortcut.TIID.GetShortcutKey()}^Device 1 ({mapping.Bus})^{mapping.Box}^Term {mapping.ModuleSlot} ({mapping.ModuleProduct})");

                // TODO: add mapping and overrideLink

                _systemManager.LinkVariables(source, destination);
            }
        }
    }
}
