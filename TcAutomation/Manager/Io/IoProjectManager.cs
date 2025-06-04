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
    }    /// <summary>
    /// Create the complete I/O topology from hardware configuration.
    /// </summary>
    public void CreateIoFromHardwareConfig(HardwareConfig hw)
    {
        // Step 1: Set target NetId if specified (must be done before any device operations)
        SetTargetNetId(hw.Network);
        
        // Step 2: Create I/O topology for each bus
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

    /// <summary>
    /// Sets the target NetId for remote device connection if specified in hardware config
    /// </summary>
    private void SetTargetNetId(Network network)
    {
        if (!string.IsNullOrWhiteSpace(network.AmsNetId))
        {
            try
            {
                _systemManager.SetTargetNetId(network.AmsNetId);
                Console.WriteLine($"✅ Set target NetId: {network.AmsNetId}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️  Warning: Could not set target NetId '{network.AmsNetId}': {ex.Message}");
                Console.WriteLine("   Continuing with local configuration.");
            }
        }
        else
        {
            Console.WriteLine("ℹ️  No NetId specified, using local configuration.");
        }
    }
}
