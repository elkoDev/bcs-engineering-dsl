namespace TcAutomation.Manager.Io.KBus
{
    internal static class IoMappings
    {
        /// <summary>
        /// Get the device subtype for KBus master devices (CX controllers)
        /// </summary>
        public static int GetKBusMasterSubType(string product)
            => KBusMasterDevices.TryGetValue(product, out var subType) 
                ? subType 
                : throw new ArgumentException($"Unsupported KBus master device '{product}'");

        /// <summary>
        /// Get the subtype for KBus terminals/modules
        /// </summary>
        public static int GetKBusTerminalSubType(string product)
            => KBusTerminalSubTypes.TryGetValue(product, out var subType) 
                ? subType 
                : throw new ArgumentException($"Unsupported KBus terminal '{product}'");

        /// <summary>
        /// KBus master devices (CX controllers with built-in KBus interface)
        /// Based on Beckhoff documentation - CX devices with KBus interface
        /// </summary>
        private static readonly Dictionary<string, int> KBusMasterDevices =
            new(StringComparer.OrdinalIgnoreCase)
            {
                // CX5000 series
                ["CX5000"] = 120,
                
                // CX8000 series  
                ["CX8000"] = 135,
                ["CX8190"] = 135, // Same as CX8000 family
                
                // CX9000 series
                ["CX9000"] = 105,
                
                // CX1100 series
                ["CX1100"] = 65,
                
                // Generic fallback
                ["CX-BK"] = 77,  // BX Klemmenbus Interface - generic KBus interface
                ["INTERNAL"] = 77 // For cases where product is specified as INTERNAL
            };

        /// <summary>
        /// KBus terminal subtypes based on Beckhoff documentation
        /// All KL terminals with their corresponding subtypes
        /// </summary>
        private static readonly Dictionary<string, int> KBusTerminalSubTypes =
            new(StringComparer.OrdinalIgnoreCase)
            {
                // KL1xxx - Digital Input Terminals
                ["KL1002"] = 1002, // 2-channel digital input
                ["KL1012"] = 1012, // 2-channel digital input
                ["KL1032"] = 1032, // 2-channel digital input
                ["KL1052"] = 1052, // 2-channel digital input
                ["KL1104"] = 1104, // 4-channel digital input
                ["KL1114"] = 1114, // 4-channel digital input
                ["KL1124"] = 1124, // 4-channel digital input
                ["KL1154"] = 1154, // 4-channel digital input
                ["KL1164"] = 1164, // 4-channel digital input
                ["KL1184"] = 1184, // 4-channel digital input
                ["KL1194"] = 1194, // 4-channel digital input
                ["KL1212"] = 1212, // 2-channel digital input
                ["KL1232"] = 1232, // 2-channel digital input
                ["KL1302"] = 1302, // 2-channel digital input
                ["KL1304"] = 1304, // 4-channel digital input
                ["KL1312"] = 1312, // 2-channel digital input
                ["KL1314"] = 1314, // 4-channel digital input
                ["KL1352"] = 1352, // 2-channel digital input
                ["KL1362"] = 1362, // 2-channel digital input
                ["KL1382"] = 1382, // 2-channel digital input
                ["KL1402"] = 1402, // 2-channel digital input
                ["KL1404"] = 1404, // 4-channel digital input
                ["KL1408"] = 1408, // 8-channel digital input
                ["KL1412"] = 1412, // 2-channel digital input
                ["KL1414"] = 1414, // 4-channel digital input
                ["KL1418"] = 1418, // 8-channel digital input
                ["KL1434"] = 1434, // 4-channel digital input
                ["KL1488"] = 1488, // 8-channel digital input
                ["KL1498"] = 1498, // 8-channel digital input
                ["KL1501"] = 1501, // 1-channel digital input
                ["KL1512"] = 1512, // 2-channel digital input
                ["KL1702"] = 1702, // 2-channel digital input
                ["KL1712"] = 1712, // 2-channel digital input
                ["KL1712-0060"] = 16778928, // 2-channel digital input
                ["KL1722"] = 1722, // 2-channel digital input
                ["KL1804"] = 1804, // 4-channel digital input
                ["KL1808"] = 1808, // 8-channel digital input
                ["KL1809"] = 1809, // 16-channel digital input
                ["KL1814"] = 1814, // 4-channel digital input
                ["KL1819"] = 1819, // 16-channel digital input
                ["KL1859"] = 1859, // 8-channel digital input
                ["KL1862"] = 1862, // 16-channel digital input
                ["KL1862-0010"] = 16779078, // 16-channel digital input
                ["KL1872"] = 1872, // 16-channel digital input
                ["KL1889"] = 1889, // 16-channel digital input
                ["KL1202"] = 1202, // 2-channel digital input

                // KL2xxx - Digital Output Terminals
                ["KL2012"] = 2012, // 2-channel digital output
                ["KL2022"] = 2022, // 2-channel digital output
                ["KL2032"] = 2032, // 2-channel digital output
                ["KL2114"] = 2114, // 4-channel digital output
                ["KL2124"] = 2124, // 4-channel digital output
                ["KL2134"] = 2134, // 4-channel digital output
                ["KL2184"] = 2184, // 4-channel digital output
                ["KL2212"] = 2212, // 2-channel digital output
                ["KL2284"] = 2284, // 4-channel digital output
                ["KL2404"] = 2404, // 4-channel digital output
                ["KL2408"] = 2408, // 8-channel digital output
                ["KL2424"] = 2424, // 4-channel digital output
                ["KL2442"] = 2442, // 2-channel digital output
                ["KL2488"] = 2488, // 8-channel digital output
                ["KL2502"] = 2502, // 2-channel PWM output
                ["KL2512"] = 2512, // 2-channel PWM output
                ["KL2521"] = 2521, // 1-channel pulse train output
                ["KL2531"] = 2531, // 1-channel stepper motor
                ["KL2531-1000"] = 16779747, // 1-channel stepper motor
                ["KL2532"] = 2532, // 2-channel DC motor amplifier output
                ["KL2535"] = 2535, // 2-channel PWM amplifier output
                ["KL2541"] = 2541, // 1-channel stepper motor
                ["KL2541-1000"] = 16779757, // 1-channel stepper motor
                ["KL2542"] = 2542, // 2-channel DC motor amplifier
                ["KL2545"] = 2545, // 2-channel PWM amplifier output
                ["KL2552"] = 2552, // 2-channel DC motor amplifier
                ["KL2602"] = 2602, // 2-channel output relay
                ["KL2612"] = 2612, // 2-channel output relay
                ["KL2622"] = 2622, // 2-channel output relay
                ["KL2631"] = 2631, // 1-channel power output relay
                ["KL2641"] = 2641, // 1-channel power output relay
                ["KL2652"] = 2652, // 2-channel power output relay
                ["KL2701"] = 2701, // 1-channel solid state load relay
                ["KL2702"] = 2702, // 2-channel solid state output relay
                ["KL2702-0002"] = 16779918, // 2-channel solid state output relay
                ["KL2702-0020"] = 33557134, // 2-channel solid state output relay
                ["KL2712"] = 2712, // 2-channel triac output
                ["KL2722"] = 2722, // 2-channel triac output
                ["KL2732"] = 2732, // 2-channel triac output
                ["KL2744"] = 2744, // 4-channel solid state output relay
                ["KL2751"] = 2751, // 1-channel universal dimmer
                ["KL2751-1200"] = 33557183, // 1-channel universal dimmer
                ["KL2761"] = 2761, // 1-channel universal dimmer
                ["KL2784"] = 2784, // 4-channel output
                ["KL2791"] = 2791, // 1-channel speed controller
                ["KL2791-1200"] = 33557223, // 1-channel speed controller
                ["KL2794"] = 2794, // 4-channel output
                ["KL2808"] = 2808, // 8-channel output
                ["KL2809"] = 2809, // 16-channel output
                ["KL2872"] = 2872, // 16-channel output
                ["KL2889"] = 2889, // 16-channel output

                // KL3xxx - Analog Input Terminals
                ["KL3001"] = 3001, // 1-channel analog input
                ["KL3002"] = 3002, // 2-channel analog input
                ["KL3011"] = 3011, // 1-channel analog input
                ["KL3012"] = 3012, // 2-channel analog input
                ["KL3021"] = 3021, // 1-channel analog input
                ["KL3022"] = 3022, // 2-channel analog input
                ["KL3041"] = 3041, // 1-channel analog input
                ["KL3042"] = 3042, // 2-channel analog input
                ["KL3044"] = 3044, // 4-channel analog input
                ["KL3051"] = 3051, // 1-channel analog input
                ["KL3052"] = 3052, // 2-channel analog input
                ["KL3054"] = 3054, // 4-channel analog input
                ["KL3061"] = 3061, // 1-channel analog input
                ["KL3062"] = 3062, // 2-channel analog input
                ["KL3064"] = 3064, // 4-channel analog input
                ["KL3102"] = 3102, // 2-channel analog input
                ["KL3112"] = 3112, // 2-channel analog input
                ["KL3122"] = 3122, // 2-channel analog input
                ["KL3132"] = 3132, // 2-channel analog input
                ["KL3142"] = 3142, // 2-channel analog input
                ["KL3152"] = 3152, // 2-channel analog input
                ["KL3158"] = 3158, // 8-channel analog input
                ["KL3162"] = 3162, // 2-channel analog input
                ["KL3172"] = 3172, // 2-channel analog input
                ["KL3172-0500"] = 33557604, // 2-channel analog input
                ["KL3172-1000"] = 67112036, // 2-channel analog input
                ["KL3182"] = 3182, // 2-channel analog input
                ["KL3201"] = 3201, // 1-channel analog input
                ["KL3202"] = 3202, // 2-channel analog input
                ["KL3204"] = 3204, // 4-channel analog input
                ["KL3208-0010"] = 33557640, // 8-channel analog input
                ["KL3222"] = 3222, // 2-channel analog input
                ["KL3228"] = 3228, // 8-channel analog input
                ["KL3302"] = 3302, // 2-channel analog input
                ["KL3311"] = 3311, // 1-channel analog input
                ["KL3312"] = 3312, // 2-channel analog input
                ["KL3314"] = 3314, // 4-channel analog input
                ["KL3351"] = 3351, // 1-channel resistor bridge
                ["KL3351-0001"] = 50334999, // 1-channel resistor bridge
                ["KL3356"] = 3356, // Precise 1-channel resistor bridge
                ["KL3361"] = 3361, // 1-channel oscilloscope
                ["KL3362"] = 3362, // 2-channel oscilloscope
                ["KL3403"] = 3403, // 3-phase power measurement
                ["KL3404"] = 3404, // 4-channel analog input
                ["KL3408"] = 3408, // 8-channel analog input
                ["KL3444"] = 3444, // 4-channel analog input
                ["KL3448"] = 3448, // 8-channel analog input
                ["KL3454"] = 3454, // 4-channel analog input
                ["KL3458"] = 3458, // 8-channel analog input
                ["KL3464"] = 3464, // 4-channel analog input
                ["KL3468"] = 3468, // 8-channel analog input

                // KL4xxx - Analog Output Terminals
                ["KL4001"] = 4001, // 1-channel analog output
                ["KL4002"] = 4002, // 2-channel analog output
                ["KL4004"] = 4004, // 4-channel analog output
                ["KL4011"] = 4011, // 1-channel analog output
                ["KL4012"] = 4012, // 2-channel analog output
                ["KL4021"] = 4021, // 1-channel analog output
                ["KL4022"] = 4022, // 2-channel analog output
                ["KL4031"] = 4031, // 1-channel analog output
                ["KL4032"] = 4032, // 2-channel analog output
                ["KL4034"] = 4034, // 4-channel analog output
                ["KL4112"] = 4112, // 2-channel analog output
                ["KL4122"] = 4122, // 2-channel analog output
                ["KL4132"] = 4132, // 2-channel analog output
                ["KL4404"] = 4404, // 4-channel analog output
                ["KL4408"] = 4408, // 8-channel analog output
                ["KL4414"] = 4414, // 4-channel analog output
                ["KL4418"] = 4418, // 8-channel analog output
                ["KL4424"] = 4424, // 4-channel analog output
                ["KL4428"] = 4428, // 8-channel analog output
                ["KL4434"] = 4434, // 4-channel analog output
                ["KL4438"] = 4438, // 8-channel analog output
                ["KL4494"] = 4494, // 2-channel analog output

                // KL9xxx - System Terminals
                ["KL9010"] = 9010, // End terminal
                ["KL9020"] = 9020, // Bus extension end terminal
                ["KL9050"] = 9050, // Bus extension coupler terminal
                ["KL9060"] = 9060, // Adapter terminal
                ["KL9070"] = 9070, // Shield terminal
                ["KL9080"] = 9080, // Separation terminal
                ["KL9100"] = 9100, // Power supply terminal
                ["KL9110"] = 9110, // Power supply terminal
                ["KL9150"] = 9150, // Power supply terminal
                ["KL9160"] = 9160, // Power supply terminal
                ["KL9180"] = 9180, // Potential distribution terminal
                ["KL9181"] = 9181, // Potential distribution terminal
                ["KL9182"] = 9182, // Potential distribution terminal
                ["KL9183"] = 9183, // Potential distribution terminal
                ["KL9184"] = 9184, // Potential distribution terminal
                ["KL9185"] = 9185, // Potential distribution terminal
                ["KL9186"] = 9186, // Potential distribution terminal
                ["KL9187"] = 9187, // Potential distribution terminal
                ["KL9188"] = 9188, // Potential distribution terminal
                ["KL9189"] = 9189, // Potential distribution terminal
                ["KL9190"] = 9190, // Feed terminal
                ["KL9195"] = 9195, // Shield terminal
                ["KL9200"] = 9200, // Power supply terminal
                ["KL9210"] = 9210, // Power supply terminal
                ["KL9250"] = 9250, // Power supply terminal
                ["KL9260"] = 9260, // Power supply terminal
                ["KL9290"] = 9290, // Power supply terminal
                ["KL9300"] = 9300, // 4-channel diode array terminal
                ["KL9301"] = 9301, // 7-channel diode array terminal
                ["KL9302"] = 9302, // 7-channel diode array terminal
                ["KL9309"] = 9309, // Interface terminal for KL85xx
                ["KL9400"] = 9400, // K-Bus power supply terminal
                ["KL9505"] = 9505, // Power supply terminal
                ["KL9505-0010"] = 167781665, // Power supply terminal
                ["KL9508"] = 9508, // Power supply terminal
                ["KL9508-0010"] = 167781668, // Power supply terminal
                ["KL9510"] = 9510, // Power supply terminal
                ["KL9510-0010"] = 167781670, // Power supply terminal
                ["KL9512"] = 9512, // Power supply terminal
                ["KL9512-0010"] = 167781672, // Power supply terminal
                ["KL9515"] = 9515, // Power supply terminal
                ["KL9515-0010"] = 167781675, // Power supply terminal
                ["KL9528"] = 9528, // Power supply terminal
                ["KL9540"] = 9540, // Surge filter field supply terminal
                ["KL9550"] = 9550, // Surge filter system and field supply terminal
                ["KL9560"] = 9560, // Power supply terminal
                ["KL9570"] = 9570, // Buffer capacitor terminal
            };
    }

    /// <summary>
    /// Common subtypes for KBus CreateChild() calls
    /// </summary>
    internal static class IoSubTypes
    {
        public const int KBusInterface = 77; // BX Klemmenbus Interface - generic KBus interface
    }
}
