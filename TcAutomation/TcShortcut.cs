using System.ComponentModel;
using System.Reflection;

namespace TcAutomation
{
    public enum TcShortcut
    {
        [Description("I/O Configuration")]
        TIIC,

        [Description("I/O Configuration^I/O Devices")]
        TIID,

        [Description("Real-Time Configuration")]
        TIRC,

        [Description("Real-Time Configuration^Route Settings")]
        TIRR,

        [Description("Real-Time Configuration^Additional Tasks")]
        TIRT,

        [Description("Real-Time Configuration^Real-Time Settings")]
        TIRS,

        [Description("PLC Configuration")]
        TIPC,

        [Description("NC Configuration")]
        TINC,

        [Description("CNC Configuration")]
        TICC,

        [Description("CAM Configuration")]
        TIAC
    }

    public static class TcShortcutExtensions
    {
        public static string GetDescription(this TcShortcut shortcut)
        {
            var type = typeof(TcShortcut);
            var memInfo = type.GetMember(shortcut.ToString());
            var attributes = memInfo[0].GetCustomAttribute<DescriptionAttribute>();
            return attributes?.Description ?? shortcut.ToString();
        }

        public static string GetShortcutKey(this TcShortcut shortcut) => shortcut.ToString();
    }
}
