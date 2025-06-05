using TCatSysManagerLib;

namespace TcAutomation.Manager.Io
{
    /// <summary>
    /// Abstract base class for bus-specific topology creators
    /// </summary>
    internal abstract class BusTopologyCreator
    {
        protected readonly ITcSysManager4 SystemManager;

        protected BusTopologyCreator(ITcSysManager4 systemManager)
        {
            SystemManager = systemManager;
        }

        /// <summary>
        /// Creates the topology for the specified bus
        /// </summary>
        /// <param name="bus">The bus configuration</param>
        public abstract void CreateTopology(Bus bus);
    }
}
