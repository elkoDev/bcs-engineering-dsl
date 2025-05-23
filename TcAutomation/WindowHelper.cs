using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace TcAutomation
{
    internal static class WindowHelper
    {
        private const int BM_CLICK = 0x00F5;

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr FindWindow(string? lpClassName, string? lpWindowName);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string? lpszClass, string? lpszWindow);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern int SendMessage(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);

        public static void CloseTcShellPopup()
        {
            IntPtr hWnd = FindWindow(null, "TcXaeShell");

            if (hWnd != IntPtr.Zero)
            {
                StringBuilder sb = new(256);
                _ = GetWindowText(hWnd, sb, sb.Capacity);

                if (sb.ToString().Contains("TcXaeShell", StringComparison.OrdinalIgnoreCase))
                {
                    IntPtr btnOk = FindWindowEx(hWnd, IntPtr.Zero, "Button", "OK");
                    if (btnOk != IntPtr.Zero)
                    {
                        var status = SendMessage(btnOk, BM_CLICK, IntPtr.Zero, IntPtr.Zero);
                        Console.WriteLine("✅ TcShell popup closed.");
                    }
                }
            }
        }

        public static void WaitAndCloseTcShellPopup(int timeoutMs = 20000)
        {
            var sw = Stopwatch.StartNew();
            while (sw.ElapsedMilliseconds < timeoutMs)
            {
                CloseTcShellPopup();
                Thread.Sleep(300); // retry every 300ms
            }
        }


        [DllImport("user32.dll", SetLastError = true)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    }
}
