using System.Text.RegularExpressions;
using System.Xml;
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

            // Step 2: Find the automatically created terminal coupler box
            // CX controllers automatically create a terminal coupler box when added
            ITcSmTreeItem? couplerBox = null;
            for (int i = 1; i <= master.ChildCount; i++)
            {
                var child = master.Child[i];
                if (child.ItemType == 5) // Box type
                {
                    couplerBox = child;
                    Console.WriteLine($"\t\t- Found terminal coupler: {child.Name}");
                    break;
                }
            }

            if (couplerBox == null)
            {
                throw new InvalidOperationException($"Terminal coupler box not found in master device {masterDeviceName}. The CX controller should automatically create this.");
            }            // Step 3: Create KBus Terminals (KL modules) under the coupler box
            // All terminals from all logical boxes are added to the coupler regardless of box grouping
            // Skip KL9010 (end terminal) if it already exists
            foreach (var box in bus.Boxes)
            {
                Console.WriteLine($"\t\t- Processing terminals from box: {box.Name}");

                foreach (var mod in box.Modules.OrderBy(m => m.Slot))
                {
                    // Skip KL9010 end terminal as it's automatically created by CX controllers
                    if (mod.Product.Equals("KL9010", StringComparison.OrdinalIgnoreCase))
                    {
                        Console.WriteLine($"\t\t\t- Skipped KL9010 end terminal (automatically created)");
                        continue;
                    }

                    string terminalName = $"Term {mod.Slot} ({mod.Product})";
                    int terminalSubType = IoMappings.GetKBusTerminalSubType(mod.Product);

                    var terminalItem = couplerBox.CreateChild(terminalName, terminalSubType, null, null);
                    Console.WriteLine($"\t\t\t- Created terminal: {terminalName}");
                }
            }
            Console.WriteLine("✅ KBus I/O topology created.");
            // Step 4: Update address information for online configuration
            UpdateDeviceAddresses(master);

            // Step 5: Scan and update boxes/terminals if needed
            //ScanAndUpdateBoxes(master);
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
            if (upperName.Contains("CX-BK")) return "CX-BK";            // Default fallback
            return "CX-BK";
        }

        /// <summary>
        /// Updates device address information by scanning for available devices on the target system
        /// </summary>
        private void UpdateDeviceAddresses(ITcSmTreeItem createdDevice)
        {
            try
            {
                Console.WriteLine("\t- Scanning for online devices to update address information...");

                // Step 1: Scan for available devices
                var ioRoot = SystemManager.LookupTreeItem(TcShortcut.TIID.GetShortcutKey());
                string scannedXml = ioRoot.ProduceXml(false);

                // Step 2: Parse the XML to find matching device
                var xmlDoc = new XmlDocument();
                xmlDoc.LoadXml(scannedXml);

                // Look for devices in the scanned XML
                var xmlDeviceList = xmlDoc.SelectNodes("TreeItem/DeviceGrpDef/FoundDevices/Device");
                if (xmlDeviceList == null || xmlDeviceList.Count == 0)
                {
                    Console.WriteLine("\t\t- No devices found during scan. Address information will remain default.");
                    return;
                }

                // Step 3: Find matching device by subtype
                foreach (XmlNode deviceNode in xmlDeviceList)
                {
                    var subTypeNode = deviceNode.SelectSingleNode("ItemSubType");
                    if (subTypeNode != null && int.TryParse(subTypeNode.InnerText, out int scannedSubType))
                    {
                        // Check if this scanned device matches our created device subtype
                        if (IsMatchingDeviceSubType(scannedSubType, createdDevice))
                        {
                            var addressInfoNode = deviceNode.SelectSingleNode("AddressInfo");
                            if (addressInfoNode != null)
                            {
                                // Step 4: Update the address information
                                string xmlAddress = $"<TreeItem><DeviceDef>{addressInfoNode.OuterXml}</DeviceDef></TreeItem>";
                                createdDevice.ConsumeXml(xmlAddress);
                                Console.WriteLine($"\t\t- Updated address information for device: {createdDevice.Name}");
                                break;
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"\t\t- Warning: Could not update device addresses: {ex.Message}");
                Console.WriteLine("\t\t- Continuing with default offline configuration. Addresses may need manual configuration.");
            }
        }

        /// <summary>
        /// Checks if the scanned device subtype matches our created device
        /// </summary>
        private bool IsMatchingDeviceSubType(int scannedSubType, ITcSmTreeItem createdDevice)
        {
            // For KBus devices, we look for:
            // - CX devices (subtypes 65, 105, 120, 135)
            // - CCAT devices (subtype 124) which are used by CX controllers

            var validKBusSubTypes = new[] { 65, 105, 120, 124, 135 };
            return validKBusSubTypes.Contains(scannedSubType);
        }

        /// <summary>
        /// Scans and updates boxes (terminal couplers) to ensure proper address configuration
        /// </summary>
        private void ScanAndUpdateBoxes(ITcSmTreeItem device)
        {
            try
            {
                Console.WriteLine("\t- Scanning boxes for address updates...");

                // Trigger box scanning on the device
                string scanBoxesXml = "<TreeItem><DeviceDef><ScanBoxes>1</ScanBoxes></DeviceDef></TreeItem>";
                device.ConsumeXml(scanBoxesXml);

                Console.WriteLine($"\t\t- Box scanning completed for device: {device.Name}");

                // Log the found boxes
                for (int i = 1; i <= device.ChildCount; i++)
                {
                    var box = device.Child[i];
                    if (box.ItemType == 5) // Box type
                    {
                        Console.WriteLine($"\t\t\t- Found box: {box.Name}");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"\t\t- Warning: Could not scan boxes: {ex.Message}");
                Console.WriteLine("\t\t- Continuing with existing box configuration.");
            }
        }
    }
}
