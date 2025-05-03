using EnvDTE;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using TCatSysManagerLib;

namespace TcAutomation
{
    internal class Program
    {
        private static readonly string solutionPath = @"C:\Users\elias\mscRepos\bcs-engineering-dsl\TcAutomation\generated\MyGeneratedSolution";
        private static readonly string templatePath = @"C:\TwinCAT\3.1\Components\Base\PrjTemplate\TwinCAT Project.tsproj";

        [SupportedOSPlatform("windows")]
        static void Main(string[] args)
        {
            Type? dteType = Type.GetTypeFromProgID("TcXaeShell.DTE.15.0");
            if (dteType == null)
            {
                Console.WriteLine("Failed to get DTE type.");
                return;
            }

            if (Activator.CreateInstance(dteType) is not DTE dte)
            {
                Console.WriteLine("Failed to create DTE instance.");
                return;
            }

            dte.SuppressUI = true;
            dte.MainWindow.Visible = false;

            Directory.CreateDirectory(solutionPath);

            var solution = dte.Solution;
            solution.Create(solutionPath, "MyGeneratedSolution");
            solution.SaveAs(Path.Combine(solutionPath, "MyGeneratedSolution.sln"));

            Console.WriteLine("Solution created.");

            Project project = solution.AddFromTemplate(templatePath, solutionPath, "MyTwinCATProject", false);

            Console.WriteLine("Project added from template.");

            ITcSysManager? sysManager = null;

            // Retry accessing project.Object
            const int maxRetries = 10;
            for (int i = 0; i < maxRetries; i++)
            {
                try
                {
                    sysManager = (ITcSysManager)project.Object;
                    break;
                }
                catch (COMException ex) when ((uint)ex.HResult == 0x8001010A) // RPC_E_SERVERCALL_RETRYLATER
                {
                    Console.WriteLine($"Waiting for project to load... (attempt {i + 1})");
                    System.Threading.Thread.Sleep(500);
                }
            }

            if (sysManager == null)
            {
                throw new InvalidOperationException("Failed to get ITcSysManager from project.Object after retries.");
            }

            Console.WriteLine("SysManager accessed.");

            sysManager.ActivateConfiguration();
            sysManager.StartRestartTwinCAT();

            project.Save();
            solution.SaveAs(Path.Combine(solutionPath, "MyGeneratedSolution.sln"));

            Console.WriteLine("Configuration activated and TwinCAT restarted.");
        }
    }
}
