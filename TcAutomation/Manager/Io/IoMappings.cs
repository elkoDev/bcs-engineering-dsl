namespace TcAutomation.Manager.Io
{
    internal static class IoMappings
    {
        public static int GetEthercatSubType(string product)
=> EthercatItemSubTypes.TryGetValue(product, out var subType) ? subType : IoSubTypes.EthercatDefault;

        public static int GetProfinetControllerSubType(string product)
            => ProfinetControllers.TryGetValue(product, out var subType)
                ? subType
                : throw new ArgumentException($"Unsupported Profinet controller '{product}'");

        public static int GetProfinetBoxSubType(string product)
            => ProfinetBoxes.TryGetValue(product, out var subType)
                ? subType
                : throw new ArgumentException($"Unsupported Profinet box '{product}'");

        public static int GetProfibusMasterSubType(string product)
            => ProfibusMasters.TryGetValue(product, out var subType)
                ? subType
                : throw new ArgumentException($"Unsupported Profibus master '{product}'");

        public static int GetProfibusSlaveSubType(string product)
            => ProfibusSlaves.TryGetValue(product, out var subType)
                ? subType
                : throw new ArgumentException($"Unsupported Profibus slave '{product}'");

        // Default 9099 for EtherCAT terminals/modules — overridden when listed here
        private static readonly Dictionary<string, int> EthercatItemSubTypes =
            new(StringComparer.OrdinalIgnoreCase)
            {
                // EtherCAT boxes / couplers
                ["EK1100"] = 9099,
                ["CU1128"] = 9099,

                // RS232/422/485 terminals (exceptions from 9099 rule)
                ["EP6002"] = 9101,
                ["EL6001"] = 9101,
                ["EL6002"] = 9101,
                ["EP6001-0002"] = 9101,
                ["EP6002-0002"] = 9101,

                ["EL6021"] = 9103,
                ["EL6022"] = 9103,
                ["EL6021-0021"] = 9103,

                // Other exceptions
                ["BK1120"] = 9081,
                ["ILXB11"] = 9086,

                // CANopen, serial comm, etc.
                ["EL6731"] = 9093,
                ["EL6751"] = 9094,
                ["EL6752"] = 9095,
                ["EL6731-0010"] = 9096,
                ["EL6751-0010"] = 9097,
                ["EL6752-0010"] = 9098,

                // Ethernet/IP, Profinet, etc.
                ["EL6601"] = 9100,
                ["EL6720"] = 9104,
                ["EL6631"] = 9106,
                ["EL6631-0010"] = 9107,
                ["EL6632"] = 9108,
                ["EL6652-0010"] = 9109,
                ["EL6652"] = 9110
            };

        private static readonly Dictionary<string, int> ProfinetControllers =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["ControllerRT"] = 113,
                ["ControllerCCAT"] = 140,
                ["EL6631"] = 119,
                ["EL6632"] = 126
            };

        private static readonly Dictionary<string, int> ProfinetBoxes =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["BK9102"] = 9125,
                ["EK9300"] = 9128,
                ["EL6631"] = 9130
            };

        private static readonly Dictionary<string, int> ProfibusMasters =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["EL6731"] = 86,
                ["FC310x"] = 86       // same subtype
            };

        private static readonly Dictionary<string, int> ProfibusSlaves =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["EL6731-0010"] = 97
            };
    }


    /// <summary>
    /// Common subtypes for CreateChild() calls
    /// </summary>
    internal static class IoSubTypes
    {
        public const int EthercatMaster = 111;
        public const int EthercatSlave = 130;
        public const int EthercatDefault = 9099; // Default for most terminals
    }
}
