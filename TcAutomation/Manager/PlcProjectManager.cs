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

        public void AddPlcProject()
        {
            ITcSmTreeItem plcConfig = _systemManager.LookupTreeItem(TcShortcut.TIPC.GetShortcutKey());
            ITcSmTreeItem plcProjectRoot = plcConfig.CreateChild(_config.PlcProjectName, 0, "", _config.VsXaePlcEmptyTemplateName);

            ITcPlcProject plcProjectRootIec = (ITcPlcProject)plcProjectRoot;
            plcProjectRootIec.BootProjectAutostart = true;
            plcProjectRootIec.GenerateBootProject(true);

            _plcProject = plcProjectRoot.LookupChild(_config.PlcProjectName + " Project");
            _realTimeTasks = _systemManager.LookupTreeItem(TcShortcut.TIRT.GetShortcutKey());

            Console.WriteLine($"✅ PLC project '{_config.PlcProjectName}' created successfully.");
        }

        public void SetTaskCycleTime(int cycleTime)
        {
            string xmlCycleTime = "<TreeItem><TaskDef><CycleTime>" + cycleTime + "</CycleTime></TaskDef></TreeItem>";
            ITcSmTreeItem task = _systemManager.LookupTreeItem("TIRT^PlcTask");
            task.ConsumeXml(xmlCycleTime);
            Console.WriteLine("✅ Task cycle time successfully set to " + cycleTime / 1000 + "ms.");
        }

        public void AddReference(string libraryName, string vendor = "Beckhoff Automation GmbH")
        {
            ITcSmTreeItem references = _systemManager.LookupTreeItem($"{TcShortcut.TIPC.GetShortcutKey()}^{_config.PlcProjectName}^{_config.PlcProjectName} Project^References");
            ITcPlcLibraryManager libManager = (ITcPlcLibraryManager)references;
            libManager.AddLibrary(libraryName, "*", vendor);
            Console.WriteLine($"✅ Library '{libraryName}' added successfully.");
        }
    }
}
