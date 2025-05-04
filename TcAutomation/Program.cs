using System.Runtime.Versioning;

namespace TcAutomation
{
    public class Program
    {
        [SupportedOSPlatform("windows")]
        [STAThread]
        private static void Main()
        {
            Script script = new Script();
            script.Run();
        }
    }
}
