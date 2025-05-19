using System.Text.Json;
using TCatSysManagerLib;

namespace TcAutomation.Manager.Io;

internal sealed class IoProjectManager
{
    private readonly ITcSysManager4 _sys;

    public IoProjectManager(ITcSysManager4 sys)
    {
        _sys = sys;
    }

    /// <summary>
    /// Create the complete I/O topology from a JSON file.
    /// </summary>
    public void CreateIoFromJson(string jsonPath)
    {
        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };
        var hw = JsonSerializer.Deserialize<HardwareConfig>(File.ReadAllText(jsonPath), options)
                 ?? throw new InvalidDataException("hardware.json invalid or empty");

        foreach (var bus in hw.Buses)
        {
            switch (bus.Type)
            {
                case "EtherCAT":
                    CreateEthercatTopology(bus);
                    break;

                default:
                    throw new NotSupportedException($"Unsupported bus type '{bus.Type}'");
            }
        }
    }

    private void CreateEthercatTopology(Bus bus)
    {
        var ioRoot = _sys.LookupTreeItem(TcShortcut.TIID.GetShortcutKey());

        // Step 1: Create Master
        var master = ioRoot.CreateChild(
            string.IsNullOrWhiteSpace(bus.MasterDeviceName) ? "EtherCAT Master" : bus.MasterDeviceName,
            IoSubTypes.EthercatMaster, null, null);

        // Step 2: Create Boxes (e.g., EK1100)
        foreach (var box in bus.Boxes)
        {
            var boxSubType = IoMappings.GetEthercatSubType(box.Product);
            var boxItem = master.CreateChild(box.Product, boxSubType, "", box.Product);
            Console.WriteLine($"Created box: {box.Name} ({box.Product})");

            // Step 3: Create Modules (e.g., EL1008, KL2408, etc.)
            foreach (var mod in box.Modules.OrderBy(m => m.Slot))
            {
                string moduleName = $"Term {mod.Slot} ({mod.Product})";
                int modSubType = IoMappings.GetEthercatSubType(mod.Product);
                boxItem.CreateChild(moduleName, modSubType, null, mod.Product);
                Console.WriteLine($"Created module: {moduleName}");
            }
        }

        Console.WriteLine("✅ EtherCAT I/O topology created.");
    }
}
