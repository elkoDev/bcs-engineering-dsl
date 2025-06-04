using System.Text.RegularExpressions;
using TCatSysManagerLib;

namespace TcAutomation.Manager.Io.KBus
{
    /// <summary>
    /// Creates KBus topology from bus configuration
    /// </summary>
    internal class KBusTopologyCreator : BusTopologyCreator
    {
        public KBusTopologyCreator(ITcSysManager4 systemManager) 
            : base(systemManager) { }

        public override void CreateTopology(Bus bus)
        {
            var ioRoot = SystemManager.LookupTreeItem(TcShortcut.TIID.GetShortcutKey());

            // Step 1: Create KBus Master Device (CX controller)
            // For KBus, the master device is typically a CX controller with built-in KBus interface
            var masterDeviceName = string.IsNullOrWhiteSpace(bus.MasterDeviceName) ? "Device 1 (CX-BK)" : bus.MasterDeviceName;
            
            // Extract the controller type from the master device name or use fallback
            string controllerType = ExtractControllerType(masterDeviceName);
            int masterSubType = IoMappings.GetKBusMasterSubType(controllerType);
            
            var master = ioRoot.CreateChild(masterDeviceName, masterSubType, null, null);
            Console.WriteLine($"\t- Created KBus master: {master.Name} (Type: {controllerType})");

            // Step 2: Create KBus interface within the master device
            // For KBus, we need to create the KBus interface first
            var kbusInterface = master.CreateChild("K-Bus", IoSubTypes.KBusInterface, null, null);
            Console.WriteLine($"\t\t- Created K-Bus interface");

            // Step 3: Process boxes - for KBus, boxes are typically INTERNAL since terminals connect directly
            foreach (var box in bus.Boxes)
            {
                ITcSmTreeItem parentForTerminals;
                
                if (box.Product.Equals("INTERNAL", StringComparison.OrdinalIgnoreCase))
                {
                    // For INTERNAL boxes, terminals are added directly to the KBus interface
                    parentForTerminals = kbusInterface;
                    Console.WriteLine($"\t\t- Processing internal KBus terminals");
                }
                else
                {
                    // For specific box products (e.g., BK9000), create the box first
                    // This is less common for KBus but supported for compatibility
                    var boxSubType = IoMappings.GetKBusTerminalSubType(box.Product);
                    parentForTerminals = kbusInterface.CreateChild(box.Product, boxSubType, "", box.Product);
                    Console.WriteLine($"\t\t- Created box: {box.Name} ({box.Product})");
                }

                // Step 4: Create KBus Terminals (KL modules)
                foreach (var mod in box.Modules.OrderBy(m => m.Slot))
                {
                    string terminalName = $"Term {mod.Slot} ({mod.Product})";
                    int terminalSubType = IoMappings.GetKBusTerminalSubType(mod.Product);
                    
                    var terminalItem = parentForTerminals.CreateChild(terminalName, terminalSubType, null, null);
                    Console.WriteLine($"\t\t\t- Created terminal: {terminalName}");
                }
            }

            Console.WriteLine("✅ KBus I/O topology created.");
        }

        /// <summary>
        /// Extract controller type from master device name
        /// Examples: "Device 1 (CX-BK)" -> "CX-BK", "Device 2 (CX8190)" -> "CX8190"
        /// </summary>
        private string ExtractControllerType(string masterDeviceName)
        {
            if (string.IsNullOrWhiteSpace(masterDeviceName))
                return "CX-BK";            // Try to extract content within parentheses
            var match = Regex.Match(masterDeviceName, @"\(([^)]+)\)");
            if (match.Success)
            {
                return match.Groups[1].Value;
            }

            // If no parentheses, check if the name itself contains a known controller type
            var upperName = masterDeviceName.ToUpperInvariant();
            if (upperName.Contains("CX8190")) return "CX8190";
            if (upperName.Contains("CX8000")) return "CX8000";
            if (upperName.Contains("CX9000")) return "CX9000";
            if (upperName.Contains("CX5000")) return "CX5000";
            if (upperName.Contains("CX1100")) return "CX1100";
            if (upperName.Contains("CX-BK")) return "CX-BK";

            // Default fallback
            return "CX-BK";
        }
    }
}
