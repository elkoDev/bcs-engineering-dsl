using TCatSysManagerLib;

namespace TcAutomation.Manager
{
    internal class PlcProjectManager
    {
        private readonly ITcSysManager4 _systemManager;
        private readonly ScriptConfig _config;
        private ITcSmTreeItem? _plcProject;
        private ITcSmTreeItem? _realTimeTasks;


        public PlcProjectManager(ITcSysManager4 systemManager, ScriptConfig config)
        {
            _systemManager = systemManager;
            _config = config;
        }

        public void AddPlcProject(string plcProjectName)
        {
            ITcSmTreeItem plcConfig = _systemManager.LookupTreeItem("TIPC");
            ITcSmTreeItem plcProjectRoot = plcConfig.CreateChild(plcProjectName, 0, "", _config.VsXaePlcEmptyTemplateName);

            ITcPlcProject plcProjectRootIec = (ITcPlcProject)plcProjectRoot;
            plcProjectRootIec.BootProjectAutostart = true;
            plcProjectRootIec.GenerateBootProject(true);

            _plcProject = plcProjectRoot.LookupChild(plcProjectName + " Project");
            _realTimeTasks = _systemManager.LookupTreeItem("TIRT");
        }
    }
}
