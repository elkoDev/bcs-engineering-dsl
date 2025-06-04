using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace TcAutomation.Helper
{
    internal static class WindowHelper
    {
        private const int BM_CLICK = 0x00F5;

        [DllImport("user32.dll", SetLastError = true)]
        private static extern nint FindWindow(string? lpClassName, string? lpWindowName);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern nint FindWindowEx(nint hwndParent, nint hwndChildAfter, string? lpszClass, string? lpszWindow);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern int SendMessage(nint hWnd, int Msg, nint wParam, nint lParam);

        public static void CloseTcShellPopup()
        {
            nint hWnd = FindWindow(null, "TcXaeShell");

            if (hWnd != nint.Zero)
            {
                StringBuilder sb = new(256);
                _ = GetWindowText(hWnd, sb, sb.Capacity);

                if (sb.ToString().Contains("TcXaeShell", StringComparison.OrdinalIgnoreCase))
                {
                    nint btnOk = FindWindowEx(hWnd, nint.Zero, "Button", "OK");
                    if (btnOk != nint.Zero)
                    {
                        var status = SendMessage(btnOk, BM_CLICK, nint.Zero, nint.Zero);
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
        private static extern int GetWindowText(nint hWnd, StringBuilder lpString, int nMaxCount);
    }
}
