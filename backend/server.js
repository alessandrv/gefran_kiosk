const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Network interface management using nmcli and system commands
class NetworkManager {
  constructor() {
    this.hasNmcli = false;
  }

  async init() {
    try {
      // Check if nmcli is available
      await execAsync('which nmcli');
      await execAsync('nmcli --version');
      this.hasNmcli = true;
      console.log('NetworkManager CLI (nmcli) is available');
      
      // Clean up any duplicate connections from previous runs
      await this.cleanupDuplicateConnections();
      
      return true;
    } catch (error) {
      console.log('nmcli not available, using system commands only');
      this.hasNmcli = false;
      return false;
    }
  }

  async getDevices() {
    if (this.hasNmcli) {
      return await this.getDevicesNmcli();
    } else {
      return await this.getDevicesFallback();
    }
  }

  async getDevicesNmcli() {
    try {
      // Get device information using nmcli
      const { stdout: deviceOutput } = await execAsync('nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status');
      const { stdout: connectionOutput } = await execAsync('nmcli -t -f NAME,UUID,TYPE,DEVICE connection show --active');
      
      console.log('nmcli device output:', deviceOutput);
      console.log('nmcli connection output:', connectionOutput);
      
      const devices = [];
      const lines = deviceOutput.trim().split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const [deviceName, deviceType, state, connection] = line.split(':');
        
        if (!deviceName || deviceName === 'lo') continue; // Skip loopback
        
        // Get detailed device information
        const deviceInfo = await this.getDeviceDetails(deviceName);
        
        devices.push({
          id: deviceInfo.id || deviceName,
          name: deviceName,
          type: this.mapDeviceType(deviceType),
          state: this.mapDeviceState(state),
          connection: connection || '',
          ...deviceInfo
        });
      }
      
      console.log('nmcli devices extracted:', JSON.stringify(devices, null, 2));
      return devices;
    } catch (error) {
      console.error('Error getting devices via nmcli:', error.message);
      return await this.getDevicesFallback();
    }
  }

  async getDeviceDetails(deviceName) {
    try {
      // Get hardware address and other details
      const { stdout: hwOutput } = await execAsync(`nmcli -t -f GENERAL.HWADDR device show ${deviceName}`);
      const { stdout: ipOutput } = await execAsync(`nmcli -t -f IP4.ADDRESS,IP4.GATEWAY,IP4.DNS device show ${deviceName}`);
      
      const hwMatch = hwOutput.match(/GENERAL\.HWADDR:(.+)/);
      const mac = hwMatch ? hwMatch[1].trim() : '';
      
      // Parse IP information
      let ip = '';
      let netmask = '';
      let gateway = '';
      let dns = [];
      
      const ipLines = ipOutput.split('\n');
      for (const line of ipLines) {
        if (line.includes('IP4.ADDRESS')) {
          const addressMatch = line.match(/IP4\.ADDRESS\[?\d*\]?:(.+)/);
          if (addressMatch) {
            const addressParts = addressMatch[1].trim().split('/');
            ip = addressParts[0];
            if (addressParts[1]) {
              netmask = this.prefixToNetmask(parseInt(addressParts[1]));
            }
          }
        } else if (line.includes('IP4.GATEWAY')) {
          const gatewayMatch = line.match(/IP4\.GATEWAY:(.+)/);
          if (gatewayMatch) {
            gateway = gatewayMatch[1].trim();
          }
        } else if (line.includes('IP4.DNS')) {
          const dnsMatch = line.match(/IP4\.DNS\[?\d*\]?:(.+)/);
          if (dnsMatch) {
            dns.push(dnsMatch[1].trim());
          }
        }
      }
      
      // Get IP method (DHCP vs Static) from active connection
      let ipMethod = 'auto'; // default to DHCP
      try {
        const { stdout: activeConnInfo } = await execAsync(`nmcli -t -f NAME,DEVICE connection show --active | grep ":${deviceName}$"`);
        if (activeConnInfo.trim()) {
          const activeConnection = activeConnInfo.split(':')[0];
          const { stdout: methodOutput } = await execAsync(`nmcli -t -f ipv4.method connection show "${activeConnection}"`);
          const methodMatch = methodOutput.match(/ipv4\.method:(.+)/);
          if (methodMatch) {
            ipMethod = methodMatch[1].trim();
          }
        }
      } catch (e) {
        console.log(`Could not get IP method for ${deviceName}:`, e.message);
      }
      
      return {
        id: deviceName,
        mac: mac,
        ip: ip,
        netmask: netmask,
        gateway: gateway,
        dns: dns,
        ipMethod: ipMethod // Add IP method to the response
      };
    } catch (error) {
      console.error(`Error getting details for ${deviceName}:`, error.message);
      return {
        id: deviceName,
        mac: '',
        ip: '',
        netmask: '',
        gateway: '',
        dns: [],
        ipMethod: 'auto'
      };
    }
  }

  // Fallback method using system commands
  async getDevicesFallback() {
    try {
      // Get interface information with JSON output
      const { stdout: addrOutput } = await execAsync('ip -j addr show');
      const interfaces = JSON.parse(addrOutput);
      
      const devices = [];
      for (const iface of interfaces) {
        if (iface.ifname === 'lo') continue; // Skip loopback
        
        const addr_info = iface.addr_info || [];
        const ipv4 = addr_info.find(addr => addr.family === 'inet');
        
        // Get MAC address from the interface
        const macAddress = iface.address || '';
        
        // Get gateway for this interface
        const gateway = await this.getGateway(iface.ifname);
        
        // Get DNS servers
        const dns = await this.getDNS();
        
        // Determine if interface is up
        const isUp = iface.flags && iface.flags.includes('UP');
        const hasCarrier = iface.flags && iface.flags.includes('LOWER_UP');
        
        devices.push({
          id: iface.ifindex.toString(),
          name: iface.ifname,
          type: this.guessInterfaceType(iface.ifname),
          state: isUp && hasCarrier ? 'activated' : 'disconnected',
          mac: macAddress,
          ip: ipv4 ? ipv4.local : '',
          netmask: ipv4 ? this.prefixToNetmask(ipv4.prefixlen) : '',
          gateway: gateway,
          dns: dns
        });
      }
      
      return devices;
    } catch (error) {
      console.error('Error in fallback method:', error.message);
      return [];
    }
  }

  async getGateway(interface_name) {
    try {
      // Get default route for this interface
      const { stdout } = await execAsync(`ip route show dev ${interface_name} default`);
      if (stdout.trim()) {
        const match = stdout.match(/default via (\d+\.\d+\.\d+\.\d+)/);
        return match ? match[1] : '';
      }
      
      // If no interface-specific default route, get global default
      const { stdout: globalRoute } = await execAsync('ip route show default');
      if (globalRoute.includes(interface_name)) {
        const match = globalRoute.match(/default via (\d+\.\d+\.\d+\.\d+)/);
        return match ? match[1] : '';
      }
      
      return '';
    } catch (error) {
      return '';
    }
  }

  async getDNS() {
    try {
      // Try systemd-resolve first (modern Ubuntu)
      try {
        const { stdout } = await execAsync('systemd-resolve --status | grep "DNS Servers"');
        const dnsServers = stdout.split('\n')
          .map(line => line.replace(/.*DNS Servers:\s*/, '').trim())
          .filter(Boolean)
          .flatMap(line => line.split(/\s+/))
          .filter(ip => /^\d+\.\d+\.\d+\.\d+$/.test(ip));
        
        if (dnsServers.length > 0) {
          return dnsServers.slice(0, 2); // Return max 2 DNS servers
        }
      } catch (e) {
        // Fall back to resolv.conf
      }
      
      // Fallback to /etc/resolv.conf
      const data = await fs.readFile('/etc/resolv.conf', 'utf8');
      const nameservers = data.split('\n')
        .filter(line => line.startsWith('nameserver'))
        .map(line => line.split(' ')[1])
        .filter(Boolean);
      return nameservers.slice(0, 2); // Return max 2 DNS servers
    } catch (error) {
      return [];
    }
  }

  mapDeviceType(nmcliType) {
    const typeMap = {
      'ethernet': 'ethernet',
      'wifi': 'wifi',
      'wireless': 'wifi',  // Some systems report as 'wireless'
      '802-11-wireless': 'wifi',  // Full 802.11 wireless type
      'bridge': 'bridge',
      'bond': 'bond',
      'vlan': 'vlan',
      'loopback': 'loopback'
    };
    
    // Check for wifi/wireless in the type string
    const lowerType = (nmcliType || '').toLowerCase();
    if (lowerType.includes('wifi') || lowerType.includes('wireless') || lowerType.includes('802-11')) {
      return 'wifi';
    }
    
    return typeMap[nmcliType] || nmcliType || 'unknown';
  }

  mapDeviceState(nmcliState) {
    const stateMap = {
      'connected': 'activated',
      'connecting': 'activating',
      'disconnected': 'disconnected',
      'unavailable': 'unavailable',
      'unmanaged': 'unmanaged'
    };
    return stateMap[nmcliState] || nmcliState || 'unknown';
  }

  guessInterfaceType(name) {
    if (name.startsWith('eth') || name.startsWith('en')) return 'ethernet';
    if (name.startsWith('wl') || name.startsWith('wlan') || name.startsWith('wifi')) return 'wifi';
    if (name.startsWith('br')) return 'bridge';
    if (name.startsWith('docker') || name.startsWith('veth')) return 'virtual';
    if (name.startsWith('tun') || name.startsWith('tap')) return 'tunnel';
    return 'unknown';
  }

  prefixToNetmask(prefix) {
    const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
    return [
      (mask >>> 24) & 0xFF,
      (mask >>> 16) & 0xFF,
      (mask >>> 8) & 0xFF,
      mask & 0xFF
    ].join('.');
  }

  netmaskToPrefix(netmask) {
    const parts = netmask.split('.').map(Number);
    let binaryString = '';
    for (const part of parts) {
      binaryString += part.toString(2).padStart(8, '0');
    }
    return binaryString.indexOf('0') === -1 ? 32 : binaryString.indexOf('0');
  }

  // Network configuration methods
  async configureInterface(deviceName, config) {
    if (!this.hasNmcli) {
      throw new Error('NetworkManager CLI not available for configuration');
    }

    try {
      const { address, netmask, gateway, dns1, dns2 } = config;
      
      console.log(`=== Configuring interface ${deviceName} ===`);
      console.log(`New config:`, { address, netmask, gateway, dns1, dns2 });
      
      // Find the active connection for this device
      let activeConnection = null;
      try {
        const { stdout: activeConnInfo } = await execAsync(`nmcli -t -f NAME,DEVICE connection show --active | grep ":${deviceName}$"`);
        if (activeConnInfo.trim()) {
          activeConnection = activeConnInfo.split(':')[0];
          console.log(`Found active connection for ${deviceName}: ${activeConnection}`);
        }
      } catch (e) {
        console.log(`No active connection found for ${deviceName}`);
      }
      
      // If no active connection, find any connection assigned to this device
      if (!activeConnection) {
        try {
          const { stdout: deviceConnInfo } = await execAsync(`nmcli -t -f NAME,DEVICE connection show | grep ":${deviceName}$"`);
          if (deviceConnInfo.trim()) {
            activeConnection = deviceConnInfo.split(':')[0];
            console.log(`Found assigned connection for ${deviceName}: ${activeConnection}`);
          }
        } catch (e) {
          console.log(`No assigned connection found for ${deviceName}`);
        }
      }
      
      if (!activeConnection) {
        throw new Error(`No connection found for interface ${deviceName}. Please ensure the interface is connected first.`);
      }
      
      // Build the modify command to change IP settings
      let modifyCmd = `nmcli connection modify "${activeConnection}"`;
      
      // Set IP method and configuration based on whether static IP is provided
      if (address && netmask) {
        // Static IP configuration
        const prefix = this.netmaskToPrefix(netmask);
        modifyCmd += ` ipv4.method manual ipv4.addresses "${address}/${prefix}"`;
        
        // Set gateway for static IP
        if (gateway) {
          modifyCmd += ` ipv4.gateway "${gateway}"`;
        } else {
          modifyCmd += ` ipv4.gateway ""`;
        }
        
        console.log(`Configuring static IP: ${address}/${prefix}`);
      } else {
        // DHCP configuration - but preserve DNS settings if provided
        modifyCmd += ` ipv4.method auto ipv4.addresses "" ipv4.gateway ""`;
        console.log(`Configuring DHCP (automatic IP)`);
      }
      
      // Handle DNS settings separately - they can be set for both DHCP and static
      if (dns1 !== undefined || dns2 !== undefined) {
        const dnsServers = [dns1, dns2].filter(dns => dns && dns.trim()).join(',');
        if (dnsServers) {
          modifyCmd += ` ipv4.dns "${dnsServers}"`;
          console.log(`Setting DNS servers: ${dnsServers}`);
        } else {
          modifyCmd += ` ipv4.dns ""`;
          console.log(`Clearing DNS servers`);
        }
      }
      
      console.log(`Modifying connection with command: ${modifyCmd}`);
      await execAsync(modifyCmd);
      
      // Reactivate the connection to apply changes
      console.log(`Reactivating connection: ${activeConnection}`);
      await execAsync(`nmcli connection up "${activeConnection}"`);
      
      // Verify the changes
      console.log('=== Verifying configuration ===');
      try {
        const { stdout: connDetails } = await execAsync(`nmcli -t -f ipv4.method,ipv4.addresses,ipv4.gateway,ipv4.dns connection show "${activeConnection}"`);
        console.log('Updated connection details:', connDetails);
      } catch (e) {
        console.log('Could not verify connection details');
      }
      
      return { success: true, message: `Interface ${deviceName} configured successfully` };
    } catch (error) {
      console.error('Error configuring interface:', error);
      throw error;
    }
  }

  async toggleInterface(deviceName) {
    if (!this.hasNmcli) {
      throw new Error('NetworkManager CLI not available for interface control');
    }

    try {
      // Get current state
      const { stdout } = await execAsync(`nmcli -t -f DEVICE,STATE device status | grep "^${deviceName}:"`);
      const state = stdout.split(':')[1];
      
      console.log(`Current state of ${deviceName}: ${state}`);
      
      if (state === 'connected') {
        console.log(`Disconnecting ${deviceName}`);
        await execAsync(`nmcli device disconnect "${deviceName}"`);
        return { success: true, message: `Interface ${deviceName} disconnected` };
      } else if (state === 'disconnected' || state === 'unavailable') {
        console.log(`Connecting ${deviceName}`);
        
        // For WiFi interfaces, we might need to connect to a specific network
        const { stdout: deviceInfo } = await execAsync(`nmcli -t -f DEVICE,TYPE device status | grep "^${deviceName}:"`);
        const deviceType = deviceInfo.split(':')[1];
        
        if (deviceType === 'wifi') {
          // Try to connect to the most recent/available connection
          try {
            const { stdout: connections } = await execAsync(`nmcli -t -f NAME,DEVICE connection show | grep ":${deviceName}$"`);
            if (connections.trim()) {
              const connectionName = connections.trim().split('\n')[0].split(':')[0];
              console.log(`Connecting WiFi using connection: ${connectionName}`);
              await execAsync(`nmcli connection up "${connectionName}"`);
            } else {
              // No saved connections, try to connect to available networks
              await execAsync(`nmcli device wifi connect --ask`);
            }
          } catch (e) {
            console.log('WiFi connection failed, trying generic device connect');
            await execAsync(`nmcli device connect "${deviceName}"`);
          }
        } else {
          // For ethernet and other types, simple connect
          await execAsync(`nmcli device connect "${deviceName}"`);
        }
        
        return { success: true, message: `Interface ${deviceName} connected` };
      } else {
        return { success: false, message: `Interface ${deviceName} is in state: ${state}` };
      }
    } catch (error) {
      console.error('Error toggling interface:', error);
      throw error;
    }
  }

  // Clean up duplicate connections created by old approach
  async cleanupDuplicateConnections() {
    if (!this.hasNmcli) {
      return;
    }

    try {
      console.log('=== Cleaning up duplicate static connections ===');
      
      // Find all connections that start with "static-"
      const { stdout: allConnections } = await execAsync('nmcli -t -f NAME,DEVICE,TYPE connection show');
      const connections = allConnections.split('\n').filter(Boolean);
      
      for (const conn of connections) {
        const [name, device, type] = conn.split(':');
        
        // Remove static-* connections that are duplicates
        if (name.startsWith('static-')) {
          console.log(`Found duplicate static connection: ${name} for device ${device}`);
          
          // Check if there's already an active connection for this device
          try {
            const { stdout: activeConn } = await execAsync(`nmcli -t -f NAME,DEVICE connection show --active | grep ":${device}$"`);
            if (activeConn.trim()) {
              const activeName = activeConn.split(':')[0];
              if (activeName !== name) {
                console.log(`Removing duplicate connection ${name} (active connection is ${activeName})`);
                await execAsync(`nmcli connection delete "${name}"`);
              }
            }
          } catch (e) {
            // If no active connection, keep the static one but log it
            console.log(`No active connection for ${device}, keeping ${name}`);
          }
        }
      }
    } catch (error) {
      console.log('Error during cleanup:', error.message);
    }
  }

  // Routing management methods
  async addRoute(destination, gateway, interfaceName, metric = 100) {
    try {
      console.log(`=== Adding route: ${destination} via ${gateway} dev ${interfaceName} metric ${metric} ===`);
      
      // Validate inputs
      if (!destination || !interfaceName) {
        throw new Error('Destination and interface are required');
      }
      
      // Build the route command
      let routeCmd = `ip route add ${destination}`;
      
      if (gateway) {
        routeCmd += ` via ${gateway}`;
      }
      
      routeCmd += ` dev ${interfaceName}`;
      
      if (metric) {
        routeCmd += ` metric ${metric}`;
      }
      
      console.log(`Executing: ${routeCmd}`);
      await execAsync(routeCmd);
      
      return { success: true, message: `Route added successfully: ${destination} via ${gateway || 'direct'} dev ${interfaceName}` };
    } catch (error) {
      console.error('Error adding route:', error);
      throw new Error(`Failed to add route: ${error.message}`);
    }
  }

  async deleteRoute(destination, gateway, interfaceName) {
    try {
      console.log(`=== Deleting route: ${destination} via ${gateway} dev ${interfaceName} ===`);
      
      // Validate inputs
      if (!destination || !interfaceName) {
        throw new Error('Destination and interface are required');
      }
      
      // Try different deletion strategies based on route type
      let routeCmd;
      let success = false;
      let lastError;
      
      // Strategy 1: Try exact match with all parameters
      if (gateway) {
        routeCmd = `ip route del ${destination} via ${gateway} dev ${interfaceName}`;
        try {
          console.log(`Trying strategy 1: ${routeCmd}`);
          await execAsync(routeCmd);
          success = true;
        } catch (error) {
          console.log(`Strategy 1 failed: ${error.message}`);
          lastError = error;
        }
      }
      
      // Strategy 2: Try without gateway (direct route)
      if (!success) {
        routeCmd = `ip route del ${destination} dev ${interfaceName}`;
        try {
          console.log(`Trying strategy 2: ${routeCmd}`);
          await execAsync(routeCmd);
          success = true;
        } catch (error) {
          console.log(`Strategy 2 failed: ${error.message}`);
          lastError = error;
        }
      }
      
      // Strategy 3: Try with just destination (let kernel figure out the rest)
      if (!success) {
        routeCmd = `ip route del ${destination}`;
        try {
          console.log(`Trying strategy 3: ${routeCmd}`);
          await execAsync(routeCmd);
          success = true;
        } catch (error) {
          console.log(`Strategy 3 failed: ${error.message}`);
          lastError = error;
        }
      }
      
      if (!success) {
        throw new Error(`All deletion strategies failed. Last error: ${lastError?.message || 'Unknown error'}`);
      }
      
      return { success: true, message: `Route deleted successfully: ${destination}` };
    } catch (error) {
      console.error('Error deleting route:', error);
      // Ensure we always return a proper error message, not HTML
      const errorMessage = error.message || 'Unknown error occurred while deleting route';
      throw new Error(`Failed to delete route: ${errorMessage}`);
    }
  }

  async getRoutes() {
    try {
      const { stdout } = await execAsync('ip route show');
      console.log('Raw route output:', stdout);
      
      const routes = stdout.split('\n')
        .filter(line => line.trim())
        .map((line, index) => {
          const parts = line.trim().split(/\s+/);
          console.log(`Parsing route line ${index + 1}: "${line.trim()}"`);
          console.log(`Parts:`, parts);
          
          // Handle different route formats
          let destination = parts[0];
          if (destination === 'default') {
            destination = '0.0.0.0/0';
          } else if (!destination.includes('/')) {
            // If no CIDR notation, assume /32 for host routes
            if (destination.match(/^\d+\.\d+\.\d+\.\d+$/)) {
              destination += '/32';
            }
          }
          
          const gatewayIndex = parts.indexOf('via');
          const devIndex = parts.indexOf('dev');
          const metricIndex = parts.indexOf('metric');
          const protoIndex = parts.indexOf('proto');
          
          // Create a unique ID based on destination, gateway, and interface
          const gateway = gatewayIndex !== -1 ? parts[gatewayIndex + 1] : '';
          const interfaceName = devIndex !== -1 ? parts[devIndex + 1] : '';
          
          // Improved ID generation - more readable and URL-safe
          let routeId = destination.replace(/\//g, '_');
          if (gateway) {
            routeId += `-via-${gateway}`;
          }
          if (interfaceName) {
            routeId += `-dev-${interfaceName}`;
          }
          // Replace any remaining special characters
          routeId = routeId.replace(/[^a-zA-Z0-9\-_\.]/g, '_');
          
          const route = {
            id: routeId,
            destination,
            gateway,
            interface: interfaceName,
            metric: metricIndex !== -1 ? parseInt(parts[metricIndex + 1]) : 0,
            protocol: protoIndex !== -1 ? parts[protoIndex + 1] : '',
            enabled: true,
            // Store original line for deletion purposes
            originalLine: line.trim()
          };
          
          console.log(`Generated route:`, route);
          return route;
        })
        .filter(route => {
          const isValid = route.destination && route.interface;
          if (!isValid) {
            console.log(`Filtering out invalid route:`, route);
          }
          return isValid;
        });

      console.log('Final parsed routes:', JSON.stringify(routes, null, 2));
      return routes;
    } catch (error) {
      console.error('Error getting routes:', error);
      throw new Error('Failed to get routing table');
    }
  }

  // DNS management methods
  async getDNSSettings() {
    try {
      console.log('=== Getting DNS settings ===');
      
      const dnsSettings = {
        global: {
          primary: '',
          secondary: '',
          searchDomains: []
        },
        interfaces: {}
      };
      
      // Get global DNS from systemd-resolved or resolv.conf
      try {
        // Try systemd-resolve first (modern Ubuntu)
        const { stdout: resolveStatus } = await execAsync('systemd-resolve --status');
        console.log('systemd-resolve status:', resolveStatus);
        
        // Parse global DNS servers
        const globalDnsMatch = resolveStatus.match(/Global[\s\S]*?DNS Servers:\s*([^\n]+)/);
        if (globalDnsMatch) {
          const dnsServers = globalDnsMatch[1].trim().split(/\s+/);
          dnsSettings.global.primary = dnsServers[0] || '';
          dnsSettings.global.secondary = dnsServers[1] || '';
        }
        
        // Parse search domains
        const searchMatch = resolveStatus.match(/DNS Domain:\s*([^\n]+)/);
        if (searchMatch) {
          dnsSettings.global.searchDomains = searchMatch[1].trim().split(/\s+/);
        }
      } catch (e) {
        console.log('systemd-resolve not available, trying resolv.conf');
        
        // Fallback to /etc/resolv.conf
        try {
          const resolvConf = await fs.readFile('/etc/resolv.conf', 'utf8');
          const lines = resolvConf.split('\n');
          
          const nameservers = [];
          const searchDomains = [];
          
          for (const line of lines) {
            if (line.startsWith('nameserver')) {
              const dns = line.split(/\s+/)[1];
              if (dns) nameservers.push(dns);
            } else if (line.startsWith('search') || line.startsWith('domain')) {
              const domains = line.split(/\s+/).slice(1);
              searchDomains.push(...domains);
            }
          }
          
          dnsSettings.global.primary = nameservers[0] || '';
          dnsSettings.global.secondary = nameservers[1] || '';
          dnsSettings.global.searchDomains = searchDomains;
        } catch (e) {
          console.log('Could not read resolv.conf');
        }
      }
      
      // Get per-interface DNS settings if using nmcli
      if (this.hasNmcli) {
        try {
          const { stdout: connections } = await execAsync('nmcli -t -f NAME,DEVICE connection show --active');
          const activeConnections = connections.split('\n').filter(Boolean);
          
          for (const conn of activeConnections) {
            const [name, device] = conn.split(':');
            if (device && device !== 'lo') {
              try {
                const { stdout: dnsInfo } = await execAsync(`nmcli -t -f ipv4.dns connection show "${name}"`);
                const dnsMatch = dnsInfo.match(/ipv4\.dns:\s*(.+)/);
                if (dnsMatch && dnsMatch[1].trim()) {
                  const interfaceDns = dnsMatch[1].trim().split(',').map(s => s.trim());
                  dnsSettings.interfaces[device] = {
                    primary: interfaceDns[0] || '',
                    secondary: interfaceDns[1] || ''
                  };
                }
              } catch (e) {
                console.log(`Could not get DNS for interface ${device}`);
              }
            }
          }
        } catch (e) {
          console.log('Could not get interface-specific DNS settings');
        }
      }
      
      console.log('DNS settings:', JSON.stringify(dnsSettings, null, 2));
      return dnsSettings;
    } catch (error) {
      console.error('Error getting DNS settings:', error);
      throw new Error('Failed to get DNS settings');
    }
  }

  async updateGlobalDNS(primary, secondary, searchDomains = []) {
    try {
      console.log(`=== Updating global DNS: ${primary}, ${secondary} ===`);
      
      if (!this.hasNmcli) {
        throw new Error('NetworkManager CLI not available for DNS configuration');
      }
      
      // Update global DNS via NetworkManager
      // Note: This approach sets DNS for the default connection
      try {
        // Get the default route interface
        const { stdout: defaultRoute } = await execAsync('ip route show default');
        const devMatch = defaultRoute.match(/dev\s+(\S+)/);
        
        if (devMatch) {
          const defaultInterface = devMatch[1];
          console.log(`Setting DNS for default interface: ${defaultInterface}`);
          
          // Find the active connection for this interface
          const { stdout: activeConn } = await execAsync(`nmcli -t -f NAME,DEVICE connection show --active | grep ":${defaultInterface}$"`);
          if (activeConn.trim()) {
            const connectionName = activeConn.split(':')[0];
            
            // Build DNS string
            const dnsServers = [primary, secondary].filter(Boolean).join(',');
            
            // Update connection DNS
            let modifyCmd = `nmcli connection modify "${connectionName}"`;
            if (dnsServers) {
              modifyCmd += ` ipv4.dns "${dnsServers}"`;
            } else {
              modifyCmd += ` ipv4.dns ""`;
            }
            
            // Add search domains if provided
            if (searchDomains.length > 0) {
              modifyCmd += ` ipv4.dns-search "${searchDomains.join(',')}"`;
            }
            
            console.log(`Executing: ${modifyCmd}`);
            await execAsync(modifyCmd);
            
            // Reactivate connection to apply changes
            await execAsync(`nmcli connection up "${connectionName}"`);
          }
        }
      } catch (e) {
        console.log('Could not update via default interface, trying global approach');
        
        // Alternative: Update resolv.conf directly (less preferred)
        let resolvContent = '';
        if (primary) resolvContent += `nameserver ${primary}\n`;
        if (secondary) resolvContent += `nameserver ${secondary}\n`;
        if (searchDomains.length > 0) {
          resolvContent += `search ${searchDomains.join(' ')}\n`;
        }
        
        // Note: This might be overwritten by NetworkManager
        console.log('Writing to resolv.conf as fallback');
        await fs.writeFile('/etc/resolv.conf.backup', resolvContent);
      }
      
      return { success: true, message: 'DNS settings updated successfully' };
    } catch (error) {
      console.error('Error updating DNS settings:', error);
      throw new Error(`Failed to update DNS settings: ${error.message}`);
    }
  }

  // Network diagnostics methods
  async pingTest(target = '8.8.8.8', count = 4) {
    try {
      console.log(`=== Ping test to ${target} ===`);
      const { stdout } = await execAsync(`ping -c ${count} ${target}`);
      
      // Parse ping results
      const lines = stdout.split('\n');
      const results = {
        target,
        success: true,
        packets: {
          transmitted: 0,
          received: 0,
          loss: 0
        },
        timing: {
          min: 0,
          avg: 0,
          max: 0,
          mdev: 0
        },
        output: stdout
      };
      
      // Parse packet statistics
      const packetLine = lines.find(line => line.includes('packets transmitted'));
      if (packetLine) {
        const packetMatch = packetLine.match(/(\d+) packets transmitted, (\d+) received, (\d+)% packet loss/);
        if (packetMatch) {
          results.packets.transmitted = parseInt(packetMatch[1]);
          results.packets.received = parseInt(packetMatch[2]);
          results.packets.loss = parseInt(packetMatch[3]);
        }
      }
      
      // Parse timing statistics
      const timingLine = lines.find(line => line.includes('min/avg/max/mdev'));
      if (timingLine) {
        const timingMatch = timingLine.match(/min\/avg\/max\/mdev = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+) ms/);
        if (timingMatch) {
          results.timing.min = parseFloat(timingMatch[1]);
          results.timing.avg = parseFloat(timingMatch[2]);
          results.timing.max = parseFloat(timingMatch[3]);
          results.timing.mdev = parseFloat(timingMatch[4]);
        }
      }
      
      return results;
    } catch (error) {
      console.error('Ping test failed:', error);
      return {
        target,
        success: false,
        error: error.message,
        output: error.stdout || error.message
      };
    }
  }

  async traceroute(target = '8.8.8.8', maxHops = 15) {
    try {
      console.log(`=== Traceroute to ${target} ===`);
      const { stdout } = await execAsync(`traceroute -m ${maxHops} ${target}`);
      
      const lines = stdout.split('\n').filter(line => line.trim());
      const hops = [];
      
      for (const line of lines) {
        if (line.match(/^\s*\d+/)) {
          const hopMatch = line.match(/^\s*(\d+)\s+(.+)/);
          if (hopMatch) {
            hops.push({
              hop: parseInt(hopMatch[1]),
              details: hopMatch[2].trim()
            });
          }
        }
      }
      
      return {
        target,
        success: true,
        hops,
        output: stdout
      };
    } catch (error) {
      console.error('Traceroute failed:', error);
      return {
        target,
        success: false,
        error: error.message,
        output: error.stdout || error.message
      };
    }
  }

  async getNetworkStatistics() {
    try {
      console.log('=== Getting network statistics ===');
      
      // Get interface statistics
      const { stdout: ifaceStats } = await execAsync('cat /proc/net/dev');
      const interfaces = {};
      
      const lines = ifaceStats.split('\n').slice(2); // Skip header lines
      for (const line of lines) {
        if (line.trim()) {
          const parts = line.trim().split(/\s+/);
          const ifaceName = parts[0].replace(':', '');
          
          if (ifaceName !== 'lo') {
            interfaces[ifaceName] = {
              rx: {
                bytes: parseInt(parts[1]) || 0,
                packets: parseInt(parts[2]) || 0,
                errors: parseInt(parts[3]) || 0,
                dropped: parseInt(parts[4]) || 0
              },
              tx: {
                bytes: parseInt(parts[9]) || 0,
                packets: parseInt(parts[10]) || 0,
                errors: parseInt(parts[11]) || 0,
                dropped: parseInt(parts[12]) || 0
              }
            };
          }
        }
      }
      
      // Get connection statistics
      const { stdout: connStats } = await execAsync('ss -tuln');
      const connections = {
        tcp: 0,
        udp: 0,
        listening: 0
      };
      
      const connLines = connStats.split('\n');
      for (const line of connLines) {
        if (line.includes('tcp')) connections.tcp++;
        if (line.includes('udp')) connections.udp++;
        if (line.includes('LISTEN')) connections.listening++;
      }
      
      return {
        interfaces,
        connections,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting network statistics:', error);
      throw new Error('Failed to get network statistics');
    }
  }
}

// Initialize NetworkManager
const networkManager = new NetworkManager();

// Routes
app.get('/api/network/interfaces', async (req, res) => {
  try {
    const devices = await networkManager.getDevices();
    console.log('Raw devices data:', JSON.stringify(devices, null, 2));
    
    // Transform to match frontend interface
    const interfaces = devices.map(device => ({
      id: device.id,
      name: device.name,
      mac: device.mac || '',
      type: device.ipMethod === 'manual' ? 'Static' : 'DHCP', // Use actual IP method
      address: device.ip || '',
      secondaryAddress: '',
      netmask: device.netmask || '',
      gateway: device.gateway || '',
      dns1: device.dns && device.dns[0] ? device.dns[0] : '',
      dns2: device.dns && device.dns[1] ? device.dns[1] : '',
      status: device.state === 'activated' ? 'active' : 'inactive',
      enabled: device.state === 'activated'
    }));

    console.log('Transformed interfaces:', JSON.stringify(interfaces, null, 2));
    res.json({ interfaces });
  } catch (error) {
    console.error('Error getting interfaces:', error);
    res.status(500).json({ error: 'Failed to get network interfaces' });
  }
});

app.get('/api/network/routing', async (req, res) => {
  try {
    const routes = await networkManager.getRoutes();
    res.json({ routes });
  } catch (error) {
    console.error('Error getting routing table:', error);
    res.status(500).json({ error: 'Failed to get routing table' });
  }
});

app.post('/api/network/routing', async (req, res) => {
  try {
    const { destination, gateway, interface: interfaceParam, interfaceName, metric } = req.body;
    
    // Support both 'interface' and 'interfaceName' for compatibility
    const targetInterface = interfaceName || interfaceParam;
    
    // Validate required fields
    if (!destination || !targetInterface) {
      return res.status(400).json({ error: 'Destination and interface are required' });
    }
    
    const result = await networkManager.addRoute(destination, gateway, targetInterface, metric);
    res.json(result);
  } catch (error) {
    console.error('Error adding route:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/network/routing/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`=== DELETE route request for ID: ${id} ===`);
    
    // Get current routes to find the route to delete
    const routes = await networkManager.getRoutes();
    console.log(`Found ${routes.length} routes in routing table`);
    
    const route = routes.find(r => r.id === id);
    
    if (!route) {
      console.log(`Route with ID ${id} not found`);
      console.log('Available route IDs:', routes.map(r => r.id));
      return res.status(404).json({ error: `Route not found with ID: ${id}` });
    }
    
    console.log(`Found route to delete:`, {
      id: route.id,
      destination: route.destination,
      gateway: route.gateway,
      interface: route.interface
    });
    
    const result = await networkManager.deleteRoute(route.destination, route.gateway, route.interface);
    console.log(`Route deletion result:`, result);
    
    res.json(result);
  } catch (error) {
    console.error('Error deleting route:', error);
    
    // Ensure we always return JSON, never HTML
    const errorMessage = error.message || 'Unknown error occurred while deleting route';
    const sanitizedError = errorMessage.replace(/<[^>]*>/g, ''); // Strip any HTML tags
    
    res.status(500).json({ 
      error: `Failed to delete route: ${sanitizedError}`,
      details: error.stack ? error.stack.split('\n')[0] : 'No additional details'
    });
  }
});

app.post('/api/network/interfaces/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const devices = await networkManager.getDevices();
    const device = devices.find(d => d.id === id || d.name === id);
    
    if (!device) {
      return res.status(404).json({ error: 'Interface not found' });
    }

    const result = await networkManager.toggleInterface(device.name);
    res.json(result);
  } catch (error) {
    console.error('Error toggling interface:', error);
    res.status(500).json({ error: 'Failed to toggle interface: ' + error.message });
  }
});

app.put('/api/network/interfaces/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { address, netmask, gateway, dns1, dns2 } = req.body;
    
    const devices = await networkManager.getDevices();
    const device = devices.find(d => d.id === id || d.name === id);
    
    if (!device) {
      return res.status(404).json({ error: 'Interface not found' });
    }

    const result = await networkManager.configureInterface(device.name, {
      address,
      netmask,
      gateway,
      dns1,
      dns2
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error configuring interface:', error);
    res.status(500).json({ error: 'Failed to configure interface: ' + error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// DNS Settings endpoints
app.get('/api/network/dns', async (req, res) => {
  try {
    const dnsSettings = await networkManager.getDNSSettings();
    res.json(dnsSettings);
  } catch (error) {
    console.error('Error getting DNS settings:', error);
    res.status(500).json({ error: 'Failed to get DNS settings' });
  }
});

app.put('/api/network/dns', async (req, res) => {
  try {
    const { primary, secondary, searchDomains } = req.body;
    
    const result = await networkManager.updateGlobalDNS(primary, secondary, searchDomains);
    res.json(result);
  } catch (error) {
    console.error('Error updating DNS settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Network Diagnostics endpoints
app.post('/api/network/diagnostics/ping', async (req, res) => {
  try {
    const { target, count } = req.body;
    
    if (!target) {
      return res.status(400).json({ error: 'Target is required for ping test' });
    }
    
    const result = await networkManager.pingTest(target, count);
    res.json(result);
  } catch (error) {
    console.error('Error running ping test:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/network/diagnostics/traceroute', async (req, res) => {
  try {
    const { target, maxHops } = req.body;
    
    if (!target) {
      return res.status(400).json({ error: 'Target is required for traceroute' });
    }
    
    const result = await networkManager.traceroute(target, maxHops);
    res.json(result);
  } catch (error) {
    console.error('Error running traceroute:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/network/statistics', async (req, res) => {
  try {
    const stats = await networkManager.getNetworkStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Error getting network statistics:', error);
    res.status(500).json({ error: 'Failed to get network statistics' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
  try {
    await networkManager.init();
    
    app.listen(PORT, () => {
      console.log(`Network management backend running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();