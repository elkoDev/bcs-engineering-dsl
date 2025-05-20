using TCatSysManagerLib;

namespace TcAutomation.Manager.Plc
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

            Console.WriteLine($"✅ PLC project '{_config.PlcProjectName}' created.");
        }

        /*
        public void SetTaskCycleTime(int cycleTime)
        {
            string xmlCycleTime = "<TreeItem><TaskDef><CycleTime>" + cycleTime + "</CycleTime></TaskDef></TreeItem>";
            ITcSmTreeItem task = _systemManager.LookupTreeItem("TIRT^MainPlcTask");
            task.ConsumeXml(xmlCycleTime);
            Console.WriteLine("✅ Task cycle time set to " + cycleTime / 1000 + "ms.");
        }
        */

        public void AddReference(string libraryName, string vendor = "Beckhoff Automation GmbH")
        {
            ITcSmTreeItem references = _systemManager.LookupTreeItem($"{TcShortcut.TIPC.GetShortcutKey()}^{_config.PlcProjectName}^{_config.PlcProjectName} Project^References");
            ITcPlcLibraryManager libManager = (ITcPlcLibraryManager)references;
            libManager.AddLibrary(libraryName, "*", vendor);
            Console.WriteLine($"✅ Library '{libraryName}' added.");
        }

        private string GetParentPathForType(PlcObjectType type)
        {
            string basePath = $"{TcShortcut.TIPC.GetShortcutKey()}^{_config.PlcProjectName}^{_config.PlcProjectName} Project";

            return type switch
            {
                { Name: "FunctionBlock" or "Function" } => $"{basePath}^POUs",
                { Name: "Enum" or "Struct" or "Union" or "Alias" } => $"{basePath}^DUTs",
                { Name: "GlobalVariables" } => $"{basePath}^GVLs",
                _ => basePath // fallback for root creation
            };
        }


        public ITcSmTreeItem CreatePlcObject(string name, PlcObjectType type, string? declarationText = null, string? implementationText = null)
        {
            string parentPath = GetParentPathForType(type);
            ITcSmTreeItem parent = _systemManager.LookupTreeItem(parentPath);

            object? language = type.RequiresLanguage ? IECLANGUAGETYPES.IECLANGUAGE_ST : null;

            ITcSmTreeItem newItem = parent.CreateChild(name, type.Code, "", language);


            if (type.HasDeclaration && declarationText != null)
            {
                var decl = (ITcPlcDeclaration)newItem;
                decl.DeclarationText = declarationText;
            }

            if (type.HasImplementation && implementationText != null)
            {
                var impl = (ITcPlcImplementation)newItem;
                impl.ImplementationText = implementationText;
            }

            Console.WriteLine($"✅ Created {type.Name} '{name}'.");
            return newItem;
        }

        public void SetMainPlcObject(string? declarationText = null, string? implementationText = null)
        {
            ITcSmTreeItem mainPlcObject = _systemManager.LookupTreeItem($"{TcShortcut.TIPC.GetShortcutKey()}^{_config.PlcProjectName}^{_config.PlcProjectName} Project^POUs^MAIN");
            var decl = (ITcPlcDeclaration)mainPlcObject;
            decl.DeclarationText = declarationText;
            var impl = (ITcPlcImplementation)mainPlcObject;
            impl.ImplementationText = implementationText;
            Console.WriteLine($"✅ Main PLC object set.");
        }

        public void LinkPlcInstanceWithTask()
        {
            _plcProject!.DeleteChild("PlcTask");
            _realTimeTasks!.DeleteChild("PlcTask");
            ITcSmTreeItem rtTask = _realTimeTasks!.CreateChild("MainPlcTask", (int)TREEITEMTYPES.TREEITEMTYPE_TASK);
            if (!TryLookupChild(_plcProject!, "MainPlcTask", out _))
            {

                _ = _plcProject!.CreateChild("MainPlcTask", (int)TREEITEMTYPES.TREEITEMTYPE_PLCTASK, "", "MAIN");
            }
            Console.WriteLine($"✅ Linked PLC instance with 'MainPlcTask'.");
        }

        private bool TryLookupChild(ITcSmTreeItem parent, string childName, out ITcSmTreeItem? child)
        {
            foreach (ITcSmTreeItem c in parent)
            {
                if (c.Name == childName)
                {
                    child = c;
                    return true;
                }
            }
            child = null;
            return false;
        }
    }
}
