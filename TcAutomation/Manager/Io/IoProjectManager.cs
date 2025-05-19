using TCatSysManagerLib;

namespace TcAutomation.Manager.Io
{
    internal class IoProjectManager
    {
        private readonly ITcSysManager4 _systemManager;
        private readonly ScriptConfig _config;

        public IoProjectManager(ITcSysManager4 systemManager, ScriptConfig config)
        {
            _systemManager = systemManager;
            _config = config;
        }


    }
}
