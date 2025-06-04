using System.Text.Json;
using TCatSysManagerLib;
using TcAutomation.Manager.Io.Ethercat;
using TcAutomation.Manager.Io.KBus;

namespace TcAutomation.Manager.Io;

internal sealed class IoProjectManager
{
    private readonly ITcSysManager4 _systemManager;
    private readonly Dictionary<string, BusTopologyCreator> _topologyCreators;

    public IoProjectManager(ITcSysManager4 sys)
    {
        _systemManager = sys;
        
        // Initialize topology creators for different bus types
        _topologyCreators = new Dictionary<string, BusTopologyCreator>(StringComparer.OrdinalIgnoreCase)
        {
            ["EtherCAT"] = new EthercatTopologyCreator(_systemManager),
            ["KBus"] = new KBusTopologyCreator(_systemManager)
        };
    }

    /// <summary>
    /// Create the complete I/O topology from hardware configuration.
    /// </summary>
    public void CreateIoFromHardwareConfig(HardwareConfig hw)
    {
        foreach (var bus in hw.Buses)
        {
            if (_topologyCreators.TryGetValue(bus.Type, out var creator))
            {
                Console.WriteLine($"Creating {bus.Type} topology for bus '{bus.Name}'...");
                creator.CreateTopology(bus);
            }
            else
            {
                throw new NotSupportedException($"Unsupported bus type '{bus.Type}'. Supported types: {string.Join(", ", _topologyCreators.Keys)}");
            }
        }
    }
}
