namespace TcAutomation.Manager.Io
{
    public class HardwareConfig
    {
        public List<LibraryEntry> Libraries { get; set; } = new();
        public List<Bus> Buses { get; set; } = new();
        public List<VariableMapping> VariableMappings { get; set; } = new();
        public Network Network { get; set; } = new();
    }

    public class LibraryEntry
    {
        public string Name { get; set; } = string.Empty;
        public string Vendor { get; set; } = "Beckhoff Automation GmbH";
    }

    public class Bus
    {
        public string Type { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string MasterDeviceName { get; set; } = string.Empty;
        public List<Box> Boxes { get; set; } = new();
    }

    public class Box
    {
        public string Product { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public List<Module> Modules { get; set; } = new();
    }

    public class Module
    {
        public string Product { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public int Slot { get; set; }
    }

    public class VariableMapping
    {
        public string PlcVar { get; set; } = string.Empty;
        public string Direction { get; set; } = string.Empty; // e.g., "Input" or "Output"
        public string Bus { get; set; } = string.Empty;
        public string Box { get; set; } = string.Empty;
        public string ModuleProduct { get; set; } = string.Empty;
        public int ModuleSlot { get; set; }
        public string Link { get; set; } = string.Empty; // e.g., "AI Standard Channel 1^Status^Error"

    }

    public class Network
    {
        public string Target { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public string AmsNetId { get; set; } = string.Empty;
    }
}
