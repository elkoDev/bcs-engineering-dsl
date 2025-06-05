using TCatSysManagerLib;

namespace TcAutomation.Manager.Io.Ethercat
{
    /// <summary>
    /// Creates EtherCAT topology from bus configuration
    /// </summary>
    internal class EthercatTopologyCreator : BusTopologyCreator
    {
        public EthercatTopologyCreator(ITcSysManager4 systemManager) 
            : base(systemManager) { }

        public override void CreateTopology(Bus bus)
        {
            var ioRoot = SystemManager.LookupTreeItem(TcShortcut.TIID.GetShortcutKey());

            // Step 1: Create EtherCAT Master
            var master = ioRoot.CreateChild(
                string.IsNullOrWhiteSpace(bus.MasterDeviceName) ? "EtherCAT Master" : bus.MasterDeviceName,
                IoSubTypes.EthercatMaster, null, null);
            Console.WriteLine($"\t- Created EtherCAT master: {master.Name} ({bus.MasterDeviceName})");

            // Step 2: Create Boxes (e.g., EK1100)
            foreach (var box in bus.Boxes)
            {
                var boxSubType = IoMappings.GetEthercatSubType(box.Product);
                var boxItem = master.CreateChild(box.Product, boxSubType, "", box.Product);
                Console.WriteLine($"\t\t- Created box: {box.Name} ({box.Product})");

                // Step 3: Create Modules (e.g., EL1008, etc.)
                foreach (var mod in box.Modules.OrderBy(m => m.Slot))
                {
                    string moduleName = $"Term {mod.Slot} ({mod.Product})";
                    int modSubType = IoMappings.GetEthercatSubType(mod.Product);
                    boxItem.CreateChild(moduleName, modSubType, null, mod.Product);
                    Console.WriteLine($"\t\t\t- Created module: {moduleName}");
                }
            }

            Console.WriteLine("✅ EtherCAT I/O topology created.");
        }
    }
}
