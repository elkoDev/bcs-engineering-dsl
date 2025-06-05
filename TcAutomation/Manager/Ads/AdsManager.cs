using System.Xml;
using TCatSysManagerLib;
using TcAutomation.Manager.Io;

namespace TcAutomation.Manager.Ads
{
    internal class AdsManager(ITcSysManager4 systemManager)
    {
        private readonly ITcSysManager4 _systemManager = systemManager;

        /// <summary>
        /// Sets up ADS route to the target device specified in the network configuration
        /// </summary>
        /// <param name="network">Network configuration containing IP address</param>
        /// <param name="username">Username for ADS connection (default: Administrator)</param>
        /// <param name="password">Password for ADS connection (default: 1)</param>
        /// <returns>The discovered NetId if successful, null otherwise</returns>
        public void SetupAdsRoute(Network network, string username = "Administrator", string password = "1")
        {
            if (string.IsNullOrWhiteSpace(network.IpAddress))
            {
                Console.WriteLine("No IP address specified in network configuration. Skipping ADS route setup.");
            }

            Console.WriteLine($"Setting up ADS route for target {network.IpAddress}...");

            try
            {
                // Step 1: Search for the device by IP address
                var deviceInfo = SearchDeviceByIpAddress(network.IpAddress);
                if (deviceInfo == null)
                {
                    Console.WriteLine($"❌ Device with IP {network.IpAddress} not found on network.");
                    throw new InvalidOperationException($"Device with IP {network.IpAddress} not found.");
                }

                Console.WriteLine($"\t- Found device: {deviceInfo.Name} (NetId: {deviceInfo.NetId})");

                // Step 2: Add ADS route
                AddAdsRoute(deviceInfo, username, password);

                // Step 3: Set target NetId to the discovered device
                SetTargetNetId(deviceInfo.NetId);

                Console.WriteLine($"✅ ADS route and target NetId successfully configured for {deviceInfo.Name}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Failed to set up ADS route: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// Sets the target NetId for remote device connection
        /// </summary>
        /// <param name="netId">The AMS NetId to set as target</param>
        public void SetTargetNetId(string netId)
        {
            if (string.IsNullOrWhiteSpace(netId))
            {
                Console.WriteLine("No NetId provided. Skipping target NetId setup.");
                return;
            }

            try
            {
                _systemManager.SetTargetNetId(netId);
                Console.WriteLine($"\t- Set target NetId: {netId}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"\t- Warning: Could not set target NetId '{netId}': {ex.Message}");
                Console.WriteLine("\t- Continuing with local configuration.");
                throw;
            }
        }

        /// <summary>
        /// Searches for a device by IP address using ADS broadcast search
        /// </summary>
        private DeviceInfo? SearchDeviceByIpAddress(string ipAddress)
        {
            try
            {
                // Direct search for specific IP address (requires TwinCAT 3.1 Build 4020.10+)
                string searchXml = $@"<TreeItem>
  <RoutePrj>
    <TargetList>
      <Search>{ipAddress}</Search>
    </TargetList>
  </RoutePrj>
</TreeItem>";

                ITcSmTreeItem routes = _systemManager.LookupTreeItem("TIRR");
                routes.ConsumeXml(searchXml);
                string result = routes.ProduceXml();

                // Parse the result XML
                XmlDocument xmlDocument = new();
                xmlDocument.LoadXml(result);

                var targetNode = xmlDocument.SelectSingleNode($"//TreeItem/RoutePrj/TargetList/Target[IpAddr='{ipAddress}']");
                if (targetNode != null)
                {
                    var nameNode = targetNode.SelectSingleNode("Name");
                    var netIdNode = targetNode.SelectSingleNode("NetId");
                    var ipAddrNode = targetNode.SelectSingleNode("IpAddr");

                    if (nameNode != null && netIdNode != null && ipAddrNode != null)
                    {
                        return new DeviceInfo
                        {
                            Name = nameNode.InnerText,
                            NetId = netIdNode.InnerText,
                            IpAddress = ipAddrNode.InnerText
                        };
                    }
                }

                // Fallback: General broadcast search if direct search fails
                Console.WriteLine($"\t- Direct search failed, performing general broadcast search...");
                return SearchDeviceByBroadcast(ipAddress);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"\t- Search failed: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Performs a general broadcast search and filters by IP address
        /// </summary>
        private DeviceInfo? SearchDeviceByBroadcast(string ipAddress)
        {
            try
            {
                string broadcastXml = @"<TreeItem>
  <RoutePrj>
    <TargetList>
      <BroadcastSearch>true</BroadcastSearch>
    </TargetList>
  </RoutePrj>
</TreeItem>";

                ITcSmTreeItem routes = _systemManager.LookupTreeItem("TIRR");
                routes.ConsumeXml(broadcastXml);
                string result = routes.ProduceXml();

                // Parse the result XML and find device with matching IP
                XmlDocument xmlDocument = new();
                xmlDocument.LoadXml(result);

                var nameNode = xmlDocument.SelectSingleNode($"//TreeItem/RoutePrj/TargetList/Target/IpAddr[text()='{ipAddress}']/../Name");
                var netIdNode = xmlDocument.SelectSingleNode($"//TreeItem/RoutePrj/TargetList/Target/IpAddr[text()='{ipAddress}']/../NetId");

                if (nameNode != null && netIdNode != null)
                {
                    return new DeviceInfo
                    {
                        Name = nameNode.InnerText,
                        NetId = netIdNode.InnerText,
                        IpAddress = ipAddress
                    };
                }

                return null;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"\t- Broadcast search failed: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Adds an ADS route for the specified device
        /// </summary>
        private void AddAdsRoute(DeviceInfo deviceInfo, string username, string password)
        {
            string routeName = $"Route_{deviceInfo.Name}";

            string addRouteXml = $@"<TreeItem>
  <ItemName>Route Settings</ItemName>
  <PathName>TIRR</PathName>
  <RoutePrj>
    <TargetList>
      <BroadcastSearch>true</BroadcastSearch>
    </TargetList>
    <AddRoute>
      <RemoteName>{routeName}</RemoteName>
      <RemoteNetId>{deviceInfo.NetId}</RemoteNetId>
      <RemoteIpAddr>{deviceInfo.IpAddress}</RemoteIpAddr>
      <UserName>{username}</UserName>
      <Password>{password}</Password>
      <NoEncryption></NoEncryption>
      <LocalName>Local_{deviceInfo.Name}</LocalName>
    </AddRoute>
  </RoutePrj>
</TreeItem>";

            ITcSmTreeItem routes = _systemManager.LookupTreeItem("TIRR");
            routes.ConsumeXml(addRouteXml);

            Console.WriteLine($"\t- Added ADS route: {routeName} -> {deviceInfo.IpAddress} ({deviceInfo.NetId})");
        }
    }

    /// <summary>
    /// Container for device information found during ADS search
    /// </summary>
    internal class DeviceInfo
    {
        public string Name { get; set; } = string.Empty;
        public string NetId { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
    }
}
