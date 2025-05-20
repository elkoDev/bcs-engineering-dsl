namespace TcAutomation.Manager.Io
{
    public class HardwareConfig
    {
        public List<LibraryEntry> Libraries { get; set; } = new();
        public List<Bus> Buses { get; set; } = new();
        public List<VariableMapping> VariableMappings { get; set; } = new();
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
        public string Direction { get; set; } = string.Empty; // e.g., "input" or "output"
        public string Channel { get; set; } = string.Empty;
        public int ChannelIndex { get; set; }

        public string Bus { get; set; } = string.Empty;
        public string Box { get; set; } = string.Empty;
        public string ModuleProduct { get; set; } = string.Empty;
        public int ModuleSlot { get; set; }

        public string Destination { get; set; } = string.Empty;
        public string Suggestion { get; set; } = string.Empty;
    }
}
