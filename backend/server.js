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
    // Mock firewall state for testing when UFW is not available
    this.mockFirewallState = {
      enabled: true,
      defaultIncoming: 'deny',
      defaultOutgoing: 'allow',
      defaultRouted: 'disabled',
      rules: [
        {
          id: '1',
          port: '22/tcp',
          action: 'allow',
          direction: 'in',
          from: 'Anywhere',
          enabled: true
        },
        {
          id: '2',
          port: '80/tcp',
          action: 'allow',
          direction: 'in',
          from: 'Anywhere',
          enabled: true
        }
      ],
      profiles: []
    };
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
        // DHCP configuration - clear static settings
        modifyCmd += ` ipv4.method auto ipv4.addresses "" ipv4.gateway ""`;
        console.log(`Configuring DHCP (automatic IP)`);
      }
      
      // Handle DNS settings (independent of IP method)
      // DNS can be set for both DHCP and static configurations
      if (dns1 || dns2) {
        const dnsServers = [dns1, dns2].filter(Boolean).join(',');
        modifyCmd += ` ipv4.dns "${dnsServers}"`;
        modifyCmd += ` ipv4.ignore-auto-dns yes`; // Ignore DHCP DNS when custom DNS is set
        console.log(`Setting interface-specific DNS: ${dnsServers}`);
      } else {
        modifyCmd += ` ipv4.dns ""`;
        modifyCmd += ` ipv4.ignore-auto-dns no`; // Use DHCP/global DNS when no custom DNS
        console.log(`Clearing interface-specific DNS (will use global/DHCP DNS)`);
      }
      
      console.log(`Modifying connection with command: ${modifyCmd}`);
      await execAsync(modifyCmd);
      
      // Reactivate the connection to apply changes
      console.log(`Reactivating connection: ${activeConnection}`);
      await execAsync(`nmcli connection up "${activeConnection}"`);
      
      // Wait a moment for the connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify the changes
      console.log('=== Verifying configuration ===');
      try {
        const { stdout: connDetails } = await execAsync(`nmcli -t -f ipv4.method,ipv4.addresses,ipv4.gateway,ipv4.dns,ipv4.ignore-auto-dns connection show "${activeConnection}"`);
        console.log('Updated connection details:', connDetails);
        
        // Also check what's actually applied to the interface
        const { stdout: deviceDetails } = await execAsync(`nmcli -t -f IP4.ADDRESS,IP4.GATEWAY,IP4.DNS device show ${deviceName}`);
        console.log('Applied device details:', deviceDetails);
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
      
      // Get global DNS from /etc/systemd/resolved.conf
      try {
        console.log('Reading global DNS from /etc/systemd/resolved.conf');
        const resolvedConf = await fs.readFile('/etc/systemd/resolved.conf', 'utf8');
        console.log('resolved.conf content:', resolvedConf);
        
        const lines = resolvedConf.split('\n');
        let inResolveSection = false;
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          // Check if we're in the [Resolve] section
          if (trimmedLine === '[Resolve]') {
            inResolveSection = true;
            continue;
          }
          
          // If we hit another section, exit [Resolve] section
          if (trimmedLine.startsWith('[') && trimmedLine !== '[Resolve]') {
            inResolveSection = false;
            continue;
          }
          
          // Parse DNS and Domains lines in [Resolve] section
          if (inResolveSection && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
            const [key, value] = trimmedLine.split('=', 2);
            const cleanKey = key.trim();
            const cleanValue = value.trim();
            
            if (cleanKey === 'DNS' && cleanValue) {
              const dnsServers = cleanValue.split(/\s+/).filter(Boolean);
              dnsSettings.global.primary = dnsServers[0] || '';
              dnsSettings.global.secondary = dnsServers[1] || '';
              console.log('Found global DNS in resolved.conf:', dnsServers);
            } else if ((cleanKey === 'Domains' || cleanKey === 'Domain') && cleanValue) {
              const domains = cleanValue.split(/\s+/).filter(Boolean);
              dnsSettings.global.searchDomains = domains;
              console.log('Found global search domains in resolved.conf:', domains);
            }
          }
        }
      } catch (e) {
        console.log('Could not read /etc/systemd/resolved.conf:', e.message);
        console.log('Trying fallback methods...');
        
        // Fallback 1: Try systemd-resolve --status for runtime info
        try {
          const { stdout: resolveStatus } = await execAsync('systemd-resolve --status');
          console.log('Using systemd-resolve --status as fallback');
          
          // Parse global DNS servers from "Global" section
          const globalSection = resolveStatus.match(/Global[\s\S]*?(?=Link \d+|$)/);
          if (globalSection) {
            const globalText = globalSection[0];
            
            // Extract DNS Servers
            const dnsMatches = globalText.match(/DNS Servers:\s*([^\n]+)/);
            if (dnsMatches) {
              const dnsServers = dnsMatches[1].trim().split(/\s+/).filter(Boolean);
              dnsSettings.global.primary = dnsServers[0] || '';
              dnsSettings.global.secondary = dnsServers[1] || '';
              console.log('Found global DNS servers from status:', dnsServers);
            }
            
            // Extract DNS Domain/Search domains
            const domainMatches = globalText.match(/DNS Domain:\s*([^\n]+)/);
            if (domainMatches) {
              const domains = domainMatches[1].trim().split(/\s+/).filter(Boolean);
              dnsSettings.global.searchDomains = domains;
              console.log('Found global search domains from status:', domains);
            }
          }
        } catch (e2) {
          console.log('systemd-resolve also failed, trying resolv.conf');
          
          // Fallback 2: /etc/resolv.conf
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
            console.log('Fallback DNS from resolv.conf:', { nameservers, searchDomains });
          } catch (e3) {
            console.log('Could not read resolv.conf either');
          }
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
      
      console.log('Final DNS settings:', JSON.stringify(dnsSettings, null, 2));
      return dnsSettings;
    } catch (error) {
      console.error('Error getting DNS settings:', error);
      throw new Error('Failed to get DNS settings');
    }
  }

  async updateGlobalDNS(primary, secondary, searchDomains = []) {
    try {
      console.log(`=== Updating global DNS: ${primary}, ${secondary} ===`);
      
      // Update /etc/systemd/resolved.conf
      try {
        // Read current resolved.conf
        let resolvedConf = '';
        try {
          resolvedConf = await fs.readFile('/etc/systemd/resolved.conf', 'utf8');
        } catch (e) {
          console.log('Could not read existing resolved.conf, creating new one');
          resolvedConf = '[Resolve]\n';
        }
        
        // Parse the config and update DNS settings
        const lines = resolvedConf.split('\n');
        const updatedLines = [];
        let inResolveSection = false;
        let dnsLineAdded = false;
        let domainsLineAdded = false;
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (trimmedLine === '[Resolve]') {
            inResolveSection = true;
            updatedLines.push(line);
            continue;
          }
          
          if (trimmedLine.startsWith('[') && trimmedLine !== '[Resolve]') {
            // Entering a different section, add DNS if not added yet
            if (inResolveSection && !dnsLineAdded && (primary || secondary)) {
              const dnsServers = [primary, secondary].filter(Boolean).join(' ');
              updatedLines.push(`DNS=${dnsServers}`);
              dnsLineAdded = true;
            }
            if (inResolveSection && !domainsLineAdded && searchDomains.length > 0) {
              updatedLines.push(`Domains=${searchDomains.join(' ')}`);
              domainsLineAdded = true;
            }
            inResolveSection = false;
            updatedLines.push(line);
            continue;
          }
          
          if (inResolveSection) {
            // Skip existing DNS and Domains lines in [Resolve] section
            if (trimmedLine.startsWith('DNS=') || trimmedLine.startsWith('#DNS=')) {
              if (!dnsLineAdded && (primary || secondary)) {
                const dnsServers = [primary, secondary].filter(Boolean).join(' ');
                updatedLines.push(`DNS=${dnsServers}`);
                dnsLineAdded = true;
              }
              continue;
            }
            if (trimmedLine.startsWith('Domains=') || trimmedLine.startsWith('#Domains=')) {
              if (!domainsLineAdded && searchDomains.length > 0) {
                updatedLines.push(`Domains=${searchDomains.join(' ')}`);
                domainsLineAdded = true;
              }
              continue;
            }
          }
          
          updatedLines.push(line);
        }
        
        // If we're still in [Resolve] section at end of file, add DNS settings
        if (inResolveSection) {
          if (!dnsLineAdded && (primary || secondary)) {
            const dnsServers = [primary, secondary].filter(Boolean).join(' ');
            updatedLines.push(`DNS=${dnsServers}`);
          }
          if (!domainsLineAdded && searchDomains.length > 0) {
            updatedLines.push(`Domains=${searchDomains.join(' ')}`);
          }
        }
        
        // If [Resolve] section doesn't exist, add it
        if (!resolvedConf.includes('[Resolve]')) {
          updatedLines.push('');
          updatedLines.push('[Resolve]');
          if (primary || secondary) {
            const dnsServers = [primary, secondary].filter(Boolean).join(' ');
            updatedLines.push(`DNS=${dnsServers}`);
          }
          if (searchDomains.length > 0) {
            updatedLines.push(`Domains=${searchDomains.join(' ')}`);
          }
        }
        
        const newResolvedConf = updatedLines.join('\n');
        
        // Backup original file
        try {
          await execAsync('cp /etc/systemd/resolved.conf /etc/systemd/resolved.conf.backup');
        } catch (e) {
          console.log('Could not backup resolved.conf');
        }
        
        // Write updated configuration
        await fs.writeFile('/etc/systemd/resolved.conf', newResolvedConf);
        console.log('Updated /etc/systemd/resolved.conf');
        
        // Restart systemd-resolved service to apply changes
        await execAsync('systemctl restart systemd-resolved');
        console.log('Restarted systemd-resolved service');
        
        // Give it a moment to restart
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (e) {
        console.error('Error updating resolved.conf:', e.message);
        throw new Error(`Failed to update global DNS configuration: ${e.message}`);
      }
      
      return { success: true, message: 'Global DNS settings updated successfully' };
    } catch (error) {
      console.error('Error updating global DNS settings:', error);
      throw new Error(`Failed to update global DNS settings: ${error.message}`);
    }
  }

  // UFW Firewall management methods
  async getFirewallStatus() {
    try {
      console.log('=== Getting UFW firewall status ===');
      
      // Check if UFW is installed
      try {
        await execAsync('which ufw');
      } catch (error) {
        console.log('UFW not found, returning mock firewall status for testing');
        // Return mock status for testing on systems without UFW
        return this.mockFirewallState;
      }
      
      // Remove --dry-run to get actual status
      const { stdout } = await execAsync('ufw status verbose');
      const statusLines = stdout.split('\n');
      
      console.log('UFW status output:', stdout);
      
      const status = {
        enabled: false,
        defaultIncoming: 'deny',
        defaultOutgoing: 'allow',
        defaultRouted: 'disabled',
        rules: [],
        profiles: []
      };
      
      // Parse status
      for (const line of statusLines) {
        const trimmed = line.trim();
        
        // Handle both English and Italian UFW status
        if (trimmed.includes('Status: active') || trimmed.includes('Stato: attivo')) {
          status.enabled = true;
          console.log('UFW is ACTIVE (found: active/attivo)');
        } else if (trimmed.includes('Status: inactive') || trimmed.includes('Stato: inattivo')) {
          status.enabled = false;
          console.log('UFW is INACTIVE (found: inactive/inattivo)');
        }
        
        // Parse default policies - handle both English and Italian
        if (trimmed.includes('deny (incoming)') || trimmed.includes('deny (in entrata)')) {
          status.defaultIncoming = 'deny';
        } else if (trimmed.includes('allow (incoming)') || trimmed.includes('allow (in entrata)')) {
          status.defaultIncoming = 'allow';
        }
        
        if (trimmed.includes('allow (outgoing)') || trimmed.includes('allow (in uscita)')) {
          status.defaultOutgoing = 'allow';
        } else if (trimmed.includes('deny (outgoing)') || trimmed.includes('deny (in uscita)')) {
          status.defaultOutgoing = 'deny';
        }
        
        if (trimmed.includes('disabled (routed)') || trimmed.includes('disabled (instradato)')) {
          status.defaultRouted = 'disabled';
        } else if (trimmed.includes('allow (routed)') || trimmed.includes('allow (instradato)')) {
          status.defaultRouted = 'allow';
        }
      }
      
      // Get detailed rules
      try {
        const { stdout: rulesOutput } = await execAsync('ufw status numbered');
        const ruleLines = rulesOutput.split('\n');
        
        console.log('UFW rules output:', rulesOutput);
        
        for (const line of ruleLines) {
          const trimmed = line.trim();
          // Parse numbered rules - handle both English and Italian formats
          // English: "[ 1] 22/tcp                     ALLOW IN    Anywhere"
          // Italian: "[ 1] 22/tcp                     ALLOW IN    Ovunque" or similar
          let ruleMatch = trimmed.match(/^\[\s*(\d+)\]\s+(.+?)\s+(ALLOW|DENY|REJECT)\s+(IN|OUT)\s+(.+)$/);
          
          // Try Italian patterns if English doesn't match
          if (!ruleMatch) {
            // Try with Italian direction words
            ruleMatch = trimmed.match(/^\[\s*(\d+)\]\s+(.+?)\s+(ALLOW|DENY|REJECT)\s+(IN ENTRATA|IN USCITA|ENTRATA|USCITA)\s+(.+)$/);
          }
          
          if (ruleMatch) {
            const [, number, port, action, direction, from] = ruleMatch;
            
            // Normalize direction to English
            let normalizedDirection = direction.toLowerCase();
            if (normalizedDirection.includes('entrata') || normalizedDirection === 'in') {
              normalizedDirection = 'in';
            } else if (normalizedDirection.includes('uscita') || normalizedDirection === 'out') {
              normalizedDirection = 'out';
            }
            
            status.rules.push({
              id: number,
              port: port.trim(),
              action: action.toLowerCase(),
              direction: normalizedDirection,
              from: from.trim(),
              enabled: true
            });
          }
        }
      } catch (e) {
        console.log('Could not parse UFW rules:', e.message);
      }
      
      // Get application profiles
      try {
        const { stdout: profilesOutput } = await execAsync('ufw app list');
        const profileLines = profilesOutput.split('\n');
        
        for (const line of profileLines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.includes('Available applications:')) {
            status.profiles.push(trimmed);
          }
        }
      } catch (e) {
        console.log('Could not get UFW application profiles');
      }
      
      console.log('Final UFW status:', JSON.stringify(status, null, 2));
      return status;
    } catch (error) {
      console.error('Error getting firewall status:', error);
      throw error;
    }
  }

  async enableFirewall() {
    try {
      console.log('=== Enabling UFW firewall ===');
      
      // Check if UFW is available
      try {
        await execAsync('which ufw');
        // Enable UFW with --force to avoid interactive prompt
        const { stdout } = await execAsync('echo "y" | ufw --force enable');
        console.log('UFW enable output:', stdout);
        return { success: true, message: 'Firewall enabled successfully' };
      } catch (error) {
        console.log('UFW not available, returning mock success');
        this.mockFirewallState.enabled = true;
        return { success: true, message: 'Firewall enabled successfully (mock)' };
      }
    } catch (error) {
      console.error('Error enabling firewall:', error);
      throw new Error(`Failed to enable firewall: ${error.message}`);
    }
  }

  async disableFirewall() {
    try {
      console.log('=== Disabling UFW firewall ===');
      
      // Check if UFW is available
      try {
        await execAsync('which ufw');
        const { stdout } = await execAsync('ufw --force disable');
        console.log('UFW disable output:', stdout);
        return { success: true, message: 'Firewall disabled successfully' };
      } catch (error) {
        console.log('UFW not available, returning mock success');
        this.mockFirewallState.enabled = false;
        return { success: true, message: 'Firewall disabled successfully (mock)' };
      }
    } catch (error) {
      console.error('Error disabling firewall:', error);
      throw new Error(`Failed to disable firewall: ${error.message}`);
    }
  }

  async resetFirewall() {
    try {
      console.log('=== Resetting UFW firewall ===');
      
      // Check if UFW is available
      try {
        await execAsync('which ufw');
        // Reset UFW to default settings
        const { stdout } = await execAsync('echo "y" | ufw --force reset');
        console.log('UFW reset output:', stdout);
        return { success: true, message: 'Firewall reset to default settings' };
      } catch (error) {
        console.log('UFW not available, returning mock success');
        this.mockFirewallState.enabled = false;
        this.mockFirewallState.defaultIncoming = 'deny';
        this.mockFirewallState.defaultOutgoing = 'allow';
        this.mockFirewallState.defaultRouted = 'disabled';
        this.mockFirewallState.rules = [];
        return { success: true, message: 'Firewall reset to default settings (mock)' };
      }
    } catch (error) {
      console.error('Error resetting firewall:', error);
      throw new Error(`Failed to reset firewall: ${error.message}`);
    }
  }

  async setDefaultPolicy(direction, policy) {
    try {
      console.log(`=== Setting default ${direction} policy to ${policy} ===`);
      console.log(`Current mock state before change:`, JSON.stringify(this.mockFirewallState, null, 2));
      
      // Validate inputs
      if (!['incoming', 'outgoing', 'routed'].includes(direction)) {
        throw new Error('Direction must be incoming, outgoing, or routed');
      }

      // Check if UFW is available
      try {
        await execAsync('which ufw');
        
        console.log(`UFW available, executing real commands`);
        
        // Handle routed policy specially
        if (direction === 'routed') {
          if (policy === 'disabled') {
            // Disable routing/forwarding
            console.log(`Executing: ufw default deny routed`);
            const { stdout } = await execAsync(`ufw default deny routed`);
            console.log('UFW routed disable output:', stdout);
            return { success: true, message: `Routed policy disabled` };
          } else if (['allow', 'deny', 'reject'].includes(policy)) {
            console.log(`Executing: ufw default ${policy} routed`);
            const { stdout } = await execAsync(`ufw default ${policy} routed`);
            console.log('UFW routed policy output:', stdout);
            return { success: true, message: `Default routed policy set to ${policy}` };
          } else {
            throw new Error('Routed policy must be allow, deny, reject, or disabled');
          }
        } else {
          // Handle incoming and outgoing policies
          if (!['allow', 'deny', 'reject'].includes(policy)) {
            throw new Error('Policy must be allow, deny, or reject');
          }
          
          console.log(`Executing: ufw default ${policy} ${direction}`);
          const { stdout } = await execAsync(`ufw default ${policy} ${direction}`);
          console.log('UFW default policy output:', stdout);
          return { success: true, message: `Default ${direction} policy set to ${policy}` };
        }
      } catch (error) {
        console.log('UFW not available, using mock functionality');
        console.log(`Mock operation: setting ${direction} policy to ${policy}`);
        
        // Update mock state
        if (direction === 'incoming') {
          console.log(`Changing defaultIncoming from ${this.mockFirewallState.defaultIncoming} to ${policy}`);
          this.mockFirewallState.defaultIncoming = policy;
        } else if (direction === 'outgoing') {
          console.log(`Changing defaultOutgoing from ${this.mockFirewallState.defaultOutgoing} to ${policy}`);
          this.mockFirewallState.defaultOutgoing = policy;
        } else if (direction === 'routed') {
          console.log(`Changing defaultRouted from ${this.mockFirewallState.defaultRouted} to ${policy}`);
          this.mockFirewallState.defaultRouted = policy;
        }
        
        console.log(`Mock state after change:`, JSON.stringify(this.mockFirewallState, null, 2));
        return { success: true, message: `Default ${direction} policy set to ${policy} (mock)` };
      }
    } catch (error) {
      console.error('Error setting default policy:', error);
      throw new Error(`Failed to set default policy: ${error.message}`);
    }
  }

  async addFirewallRule(ruleConfig) {
    try {
      const { action, direction, port, protocol, from, to, comment } = ruleConfig;
      
      console.log('=== Adding UFW firewall rule ===');
      console.log('Rule config:', ruleConfig);

      // Check if UFW is available
      try {
        await execAsync('which ufw');
        
        // Build UFW command with proper syntax
        let cmd = 'ufw';
        
        if (action) {
          cmd += ` ${action}`;
        }
        
        // Add direction
        if (direction === 'in') {
          cmd += ' in';
        } else if (direction === 'out') {
          cmd += ' out';
        }
        
        // Add from clause
        if (from && from !== 'any' && from.trim() !== '') {
          cmd += ` from ${from}`;
        }
        
        // Add to clause (if specified)
        if (to && to !== 'any' && to.trim() !== '') {
          cmd += ` to ${to}`;
        }
        
        // Add port specification - FIXED SYNTAX
        if (port && port.trim() !== '') {
          // If no 'to' clause was added, we need to add 'to any' before port
          if (!to || to === 'any' || to.trim() === '') {
            cmd += ' to any';
          }
          
          // Add port with protocol
          if (protocol) {
            cmd += ` port ${port} proto ${protocol}`;
          } else {
            cmd += ` port ${port}`;
          }
        }
        
        // Add comment if provided
        if (comment && comment.trim() !== '') {
          cmd += ` comment "${comment}"`;
        }
        
        console.log(`Executing UFW command: ${cmd}`);
        const { stdout } = await execAsync(cmd);
        console.log('UFW rule add output:', stdout);
        
        return { success: true, message: 'Firewall rule added successfully' };
      } catch (error) {
        console.log('UFW not available, returning mock success');
        // Add rule to mock state
        const newRule = {
          id: (this.mockFirewallState.rules.length + 1).toString(),
          port: port || 'any',
          action: action,
          direction: direction,
          from: from || 'Anywhere',
          enabled: true
        };
        this.mockFirewallState.rules.push(newRule);
        return { success: true, message: 'Firewall rule added successfully (mock)' };
      }
    } catch (error) {
      console.error('Error adding firewall rule:', error);
      console.error('UFW command failed with:', error.message);
      throw new Error(`Failed to add firewall rule: ${error.message}`);
    }
  }

  async deleteFirewallRule(ruleNumber) {
    try {
      console.log(`=== Deleting UFW firewall rule #${ruleNumber} ===`);
      
      // Check if UFW is available
      try {
        await execAsync('which ufw');
        // Delete rule by number
        await execAsync(`echo "y" | ufw --force delete ${ruleNumber}`);
        return { success: true, message: `Firewall rule #${ruleNumber} deleted successfully` };
      } catch (error) {
        console.log('UFW not available, returning mock success');
        // Remove rule from mock state
        const ruleIndex = this.mockFirewallState.rules.findIndex(rule => rule.id === ruleNumber.toString());
        if (ruleIndex !== -1) {
          this.mockFirewallState.rules.splice(ruleIndex, 1);
          // Renumber remaining rules
          this.mockFirewallState.rules.forEach((rule, index) => {
            rule.id = (index + 1).toString();
          });
        }
        return { success: true, message: `Firewall rule #${ruleNumber} deleted successfully (mock)` };
      }
    } catch (error) {
      console.error('Error deleting firewall rule:', error);
      throw new Error(`Failed to delete firewall rule: ${error.message}`);
    }
  }

  async getFirewallLogs(lines = 50) {
    try {
      console.log(`=== Getting UFW firewall logs (last ${lines} lines) ===`);
      
      // Get UFW logs from system journal
      const { stdout } = await execAsync(`journalctl -u ufw -n ${lines} --no-pager`);
      
      const logEntries = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          // Parse timestamp and message
          const parts = line.split(' ');
          if (parts.length >= 6) {
            const timestamp = parts.slice(0, 3).join(' ');
            const message = parts.slice(5).join(' ');
            return { timestamp, message, raw: line };
          }
          return { timestamp: '', message: line, raw: line };
        });
      
      return { logs: logEntries };
    } catch (error) {
      console.error('Error getting firewall logs:', error);
      // Return empty logs instead of throwing error
      return { logs: [] };
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

  // NTP Server management methods
  async getNTPSettings() {
    try {
      console.log('=== Getting NTP settings ===');
      
      const ntpSettings = {
        primary: '',
        fallback: '',
        status: {
          synchronized: false,
          ntpService: 'inactive',
          server: '',
          pollInterval: 0
        }
      };
      
      // Get current NTP configuration from timesyncd.conf
      try {
        console.log('Reading NTP settings from /etc/systemd/timesyncd.conf');
        const timesyncConf = await fs.readFile('/etc/systemd/timesyncd.conf', 'utf8');
        console.log('timesyncd.conf content:', timesyncConf);
        
        const lines = timesyncConf.split('\n');
        let inTimeSection = false;
        
        for (const line of lines) {
          const trimmed = line.trim();
          
          // Check if we're in the [Time] section
          if (trimmed === '[Time]') {
            inTimeSection = true;
            continue;
          }
          
          // If we hit another section, exit [Time] section
          if (trimmed.startsWith('[') && trimmed !== '[Time]') {
            inTimeSection = false;
            continue;
          }
          
          // Parse NTP and FallbackNTP lines in [Time] section
          if (inTimeSection && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [key, value] = trimmed.split('=', 2);
            const cleanKey = key.trim();
            const cleanValue = value.trim();
            
            if (cleanKey === 'NTP' && cleanValue) {
              ntpSettings.primary = cleanValue;
              console.log('Found primary NTP server:', cleanValue);
            } else if (cleanKey === 'FallbackNTP' && cleanValue) {
              ntpSettings.fallback = cleanValue;
              console.log('Found fallback NTP server:', cleanValue);
            }
          }
        }
      } catch (e) {
        console.log('Could not read /etc/systemd/timesyncd.conf:', e.message);
      }
      
      // Get current NTP status using timedatectl
      try {
        console.log('Getting NTP status from timedatectl');
        const { stdout: timesyncStatus } = await execAsync('timedatectl show-timesync --all');
        console.log('timedatectl show-timesync output:', timesyncStatus);
        
        const statusLines = timesyncStatus.split('\n');
        for (const line of statusLines) {
          const trimmed = line.trim();
          
          if (trimmed.startsWith('SystemNTPServer=')) {
            const server = trimmed.split('=')[1];
            if (server) {
              ntpSettings.status.server = server;
              console.log('Current active NTP server:', server);
            }
          } else if (trimmed.startsWith('FallbackNTPServer=')) {
            const fallbackServer = trimmed.split('=')[1];
            if (fallbackServer && !ntpSettings.fallback) {
              ntpSettings.fallback = fallbackServer;
              console.log('Current fallback NTP server:', fallbackServer);
            }
          }
        }
        
        // Get general time sync status
        const { stdout: timedateStatus } = await execAsync('timedatectl status');
        console.log('timedatectl status output:', timedateStatus);
        
        const dateStatusLines = timedateStatus.split('\n');
        for (const line of dateStatusLines) {
          const trimmed = line.trim();
          
          if (trimmed.includes('NTP service:')) {
            const status = trimmed.split(':')[1].trim();
            ntpSettings.status.ntpService = status;
            console.log('NTP service status:', status);
          } else if (trimmed.includes('System clock synchronized:')) {
            const synchronized = trimmed.split(':')[1].trim().toLowerCase() === 'yes';
            ntpSettings.status.synchronized = synchronized;
            console.log('System clock synchronized:', synchronized);
          } else if (trimmed.includes('NTP synchronized:')) {
            // Fallback for systems that might use this format
            const synchronized = trimmed.split(':')[1].trim().toLowerCase() === 'yes';
            ntpSettings.status.synchronized = synchronized;
            console.log('NTP synchronized (fallback):', synchronized);
          } else if (trimmed.includes('systemd-timesyncd.service active:')) {
            // Check if timesyncd service is active
            const active = trimmed.split(':')[1].trim().toLowerCase() === 'yes';
            if (active) {
              ntpSettings.status.ntpService = 'active';
            }
            console.log('systemd-timesyncd service active:', active);
          }
        }
        
        // Also try to get more detailed sync info from timedatectl show
        try {
          const { stdout: detailedStatus } = await execAsync('timedatectl show');
          const detailedLines = detailedStatus.split('\n');
          
          for (const line of detailedLines) {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('NTPSynchronized=')) {
              const synchronized = trimmed.split('=')[1].trim().toLowerCase() === 'yes';
              ntpSettings.status.synchronized = synchronized;
              console.log('NTPSynchronized from timedatectl show:', synchronized);
            } else if (trimmed.startsWith('NTP=')) {
              const ntpEnabled = trimmed.split('=')[1].trim().toLowerCase() === 'yes';
              if (ntpEnabled) {
                ntpSettings.status.ntpService = 'active';
              }
              console.log('NTP enabled from timedatectl show:', ntpEnabled);
            }
          }
        } catch (e) {
          console.log('Could not get detailed status from timedatectl show:', e.message);
        }
      } catch (e) {
        console.log('Could not get NTP status from timedatectl:', e.message);
      }
      
      console.log('Final NTP settings:', JSON.stringify(ntpSettings, null, 2));
      return ntpSettings;
    } catch (error) {
      console.error('Error getting NTP settings:', error);
      throw new Error('Failed to get NTP settings');
    }
  }

  async updateNTPSettings(primary, fallback = '') {
    try {
      console.log(`=== Updating NTP settings: primary=${primary}, fallback=${fallback} ===`);
      
      // Update /etc/systemd/timesyncd.conf
      try {
        // Read current timesyncd.conf
        let timesyncConf = '';
        try {
          timesyncConf = await fs.readFile('/etc/systemd/timesyncd.conf', 'utf8');
        } catch (e) {
          console.log('Could not read existing timesyncd.conf, creating new one');
          timesyncConf = '[Time]\n';
        }
        
        // Parse the config and update NTP settings
        const lines = timesyncConf.split('\n');
        const updatedLines = [];
        let inTimeSection = false;
        let ntpLineAdded = false;
        let fallbackNtpLineAdded = false;
        
        for (const line of lines) {
          const trimmed = line.trim();
          
          if (trimmed === '[Time]') {
            inTimeSection = true;
            updatedLines.push(line);
            continue;
          }
          
          if (trimmed.startsWith('[') && trimmed !== '[Time]') {
            // Entering a different section, add NTP settings if not added yet
            if (inTimeSection && !ntpLineAdded && primary) {
              updatedLines.push(`NTP=${primary}`);
              ntpLineAdded = true;
            }
            if (inTimeSection && !fallbackNtpLineAdded) {
              updatedLines.push(`FallbackNTP=${fallback}`);
              fallbackNtpLineAdded = true;
            }
            inTimeSection = false;
            updatedLines.push(line);
            continue;
          }
          
          if (inTimeSection) {
            // Skip existing NTP and FallbackNTP lines in [Time] section
            if (trimmed.startsWith('NTP=') || trimmed.startsWith('#NTP=')) {
              if (!ntpLineAdded && primary) {
                updatedLines.push(`NTP=${primary}`);
                ntpLineAdded = true;
              }
              continue;
            }
            if (trimmed.startsWith('FallbackNTP=') || trimmed.startsWith('#FallbackNTP=')) {
              if (!fallbackNtpLineAdded) {
                updatedLines.push(`FallbackNTP=${fallback}`);
                fallbackNtpLineAdded = true;
              }
              continue;
            }
          }
          
          updatedLines.push(line);
        }
        
        // If we're still in [Time] section at end of file, add NTP settings
        if (inTimeSection) {
          if (!ntpLineAdded && primary) {
            updatedLines.push(`NTP=${primary}`);
          }
          if (!fallbackNtpLineAdded) {
            updatedLines.push(`FallbackNTP=${fallback}`);
          }
        }
        
        // If [Time] section doesn't exist, add it
        if (!timesyncConf.includes('[Time]')) {
          updatedLines.push('');
          updatedLines.push('[Time]');
          if (primary) {
            updatedLines.push(`NTP=${primary}`);
          }
          updatedLines.push(`FallbackNTP=${fallback}`);
        }
        
        const newTimesyncConf = updatedLines.join('\n');
        
        // Backup original file
        try {
          await execAsync('cp /etc/systemd/timesyncd.conf /etc/systemd/timesyncd.conf.backup');
        } catch (e) {
          console.log('Could not backup timesyncd.conf');
        }
        
        // Write updated configuration
        await fs.writeFile('/etc/systemd/timesyncd.conf', newTimesyncConf);
        console.log('Updated /etc/systemd/timesyncd.conf');
        
        // Restart systemd-timesyncd service to apply changes
        await execAsync('systemctl restart systemd-timesyncd');
        console.log('Restarted systemd-timesyncd service');
        
        // Give it a moment to restart
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (e) {
        console.error('Error updating timesyncd.conf:', e.message);
        throw new Error(`Failed to update NTP configuration: ${e.message}`);
      }
      
      return { success: true, message: 'NTP settings updated successfully' };
    } catch (error) {
      console.error('Error updating NTP settings:', error);
      throw new Error(`Failed to update NTP settings: ${error.message}`);
    }
  }

  // Browser settings management methods
  async getBrowserSettings() {
    try {
      console.log('=== Getting browser settings ===');
      
      const browserSettings = {
        homepage: 'https://www.google.com',
        showHomeButton: true,
        restoreOnStartup: 4, // 4 = restore specific pages
        startupUrls: ['https://www.google.com']
      };
      
      // Try to read Chromium preferences
      const chromiumPaths = [
        '/home/kiosk-user/.config/chromium/Default/Preferences',
        '/home/kiosk/.config/chromium/Default/Preferences',
        process.env.HOME + '/.config/chromium/Default/Preferences'
      ];
      
      for (const prefPath of chromiumPaths) {
        try {
          console.log(`Trying to read Chromium preferences from: ${prefPath}`);
          const prefsData = await fs.readFile(prefPath, 'utf8');
          const prefs = JSON.parse(prefsData);
          
          console.log('Found Chromium preferences file');
          
          // Extract browser settings
          if (prefs.homepage) {
            browserSettings.homepage = prefs.homepage;
          }
          
          if (prefs.browser && prefs.browser.show_home_button !== undefined) {
            browserSettings.showHomeButton = prefs.browser.show_home_button;
          }
          
          if (prefs.session) {
            if (prefs.session.restore_on_startup !== undefined) {
              browserSettings.restoreOnStartup = prefs.session.restore_on_startup;
            }
            if (prefs.session.startup_urls && Array.isArray(prefs.session.startup_urls)) {
              browserSettings.startupUrls = prefs.session.startup_urls;
            }
          }
          
          console.log('Extracted browser settings:', browserSettings);
          break; // Found preferences, stop looking
        } catch (e) {
          console.log(`Could not read ${prefPath}: ${e.message}`);
          continue;
        }
      }
      
      return browserSettings;
    } catch (error) {
      console.error('Error getting browser settings:', error);
      throw new Error('Failed to get browser settings');
    }
  }

  async updateBrowserSettings(homepage, showHomeButton = true) {
    try {
      console.log(`=== Updating browser settings: homepage=${homepage}, showHomeButton=${showHomeButton} ===`);
      
      // Validate homepage URL
      if (homepage) {
        try {
          new URL(homepage);
        } catch (e) {
          throw new Error('Invalid homepage URL provided');
        }
      }
      
      // Find Chromium preferences file
      const chromiumPaths = [
        '/home/kiosk-user/.config/chromium/Default/Preferences',
        '/home/kiosk/.config/chromium/Default/Preferences',
        process.env.HOME + '/.config/chromium/Default/Preferences'
      ];
      
      let prefsPath = null;
      let currentPrefs = {};
      
      // Try to find existing preferences file
      for (const path of chromiumPaths) {
        try {
          const prefsData = await fs.readFile(path, 'utf8');
          currentPrefs = JSON.parse(prefsData);
          prefsPath = path;
          console.log(`Found existing preferences at: ${path}`);
          break;
        } catch (e) {
          console.log(`Could not read ${path}: ${e.message}`);
          continue;
        }
      }
      
      // If no existing preferences found, create new one for kiosk-user
      if (!prefsPath) {
        prefsPath = '/home/kiosk-user/.config/chromium/Default/Preferences';
        console.log(`Creating new preferences file at: ${prefsPath}`);
        
        // Ensure directory exists
        const prefsDir = require('path').dirname(prefsPath);
        try {
          await execAsync(`mkdir -p "${prefsDir}"`);
          // Set proper ownership for kiosk-user
          try {
            await execAsync(`chown -R kiosk-user:kiosk-user "/home/kiosk-user/.config"`);
          } catch (e) {
            console.log('Could not set ownership (may not be running as root)');
          }
        } catch (e) {
          console.log('Could not create preferences directory');
        }
      }
      
      // Update preferences object
      if (!currentPrefs.homepage_is_newtabpage) {
        currentPrefs.homepage_is_newtabpage = false;
      }
      
      if (homepage) {
        currentPrefs.homepage = homepage;
      }
      
      if (!currentPrefs.browser) {
        currentPrefs.browser = {};
      }
      currentPrefs.browser.show_home_button = showHomeButton;
      
      if (!currentPrefs.session) {
        currentPrefs.session = {};
      }
      currentPrefs.session.restore_on_startup = 4; // Restore specific pages
      
      if (homepage) {
        currentPrefs.session.startup_urls = [homepage];
      }
      
      // Add other useful browser settings
      if (!currentPrefs.bookmark_bar) {
        currentPrefs.bookmark_bar = {};
      }
      currentPrefs.bookmark_bar.show_on_all_tabs = true;
      
      if (!currentPrefs.sync_promo) {
        currentPrefs.sync_promo = {};
      }
      currentPrefs.sync_promo.show_on_first_run_allowed = false;
      
      // Backup existing file if it exists
      try {
        await execAsync(`cp "${prefsPath}" "${prefsPath}.backup"`);
      } catch (e) {
        console.log('Could not backup existing preferences file');
      }
      
      // Write updated preferences
      const prefsJson = JSON.stringify(currentPrefs, null, 2);
      await fs.writeFile(prefsPath, prefsJson);
      console.log('Updated Chromium preferences file');
      
      // Set proper ownership
      try {
        await execAsync(`chown kiosk-user:kiosk-user "${prefsPath}"`);
      } catch (e) {
        console.log('Could not set file ownership (may not be running as root)');
      }
      
      return { success: true, message: 'Browser settings updated successfully' };
    } catch (error) {
      console.error('Error updating browser settings:', error);
      throw new Error(`Failed to update browser settings: ${error.message}`);
    }
  }

  // System hostname management methods
  async getHostname() {
    try {
      console.log('=== Getting system hostname ===');
      
      const { stdout: hostname } = await execAsync('hostname');
      const currentHostname = hostname.trim();
      
      // Also get the static hostname from hostnamectl if available
      let staticHostname = currentHostname;
      try {
        const { stdout: hostnameCtl } = await execAsync('hostnamectl status');
        const staticMatch = hostnameCtl.match(/Static hostname:\s*(.+)/);
        if (staticMatch) {
          staticHostname = staticMatch[1].trim();
        }
      } catch (e) {
        console.log('hostnamectl not available, using hostname command result');
      }
      
      console.log(`Current hostname: ${currentHostname}, Static hostname: ${staticHostname}`);
      
      return {
        current: currentHostname,
        static: staticHostname
      };
    } catch (error) {
      console.error('Error getting hostname:', error);
      throw new Error('Failed to get hostname');
    }
  }

  async updateHostname(newHostname) {
    try {
      console.log(`=== Updating hostname to: ${newHostname} ===`);
      
      // Validate hostname
      if (!newHostname || typeof newHostname !== 'string') {
        throw new Error('Invalid hostname provided');
      }
      
      // Check hostname format (basic validation)
      const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$/;
      if (!hostnameRegex.test(newHostname)) {
        throw new Error('Invalid hostname format. Use only letters, numbers, and hyphens.');
      }
      
      // Update hostname using hostnamectl if available
      try {
        await execAsync(`hostnamectl set-hostname "${newHostname}"`);
        console.log('Updated hostname using hostnamectl');
      } catch (e) {
        console.log('hostnamectl not available, trying alternative methods');
        
        // Fallback: update /etc/hostname
        try {
          await fs.writeFile('/etc/hostname', newHostname + '\n');
          console.log('Updated /etc/hostname');
          
          // Also update current hostname
          await execAsync(`hostname "${newHostname}"`);
          console.log('Updated current hostname');
        } catch (e2) {
          throw new Error('Failed to update hostname using fallback methods');
        }
      }
      
      // Update /etc/hosts file to include the new hostname
      try {
        const hostsContent = await fs.readFile('/etc/hosts', 'utf8');
        const lines = hostsContent.split('\n');
        let updated = false;
        
        // Update or add localhost entry with new hostname
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('127.0.1.1') || (lines[i].includes('127.0.0.1') && lines[i].includes('localhost'))) {
            // Update existing entry
            if (lines[i].includes('127.0.1.1')) {
              lines[i] = `127.0.1.1\t${newHostname}`;
              updated = true;
            } else if (lines[i].includes('127.0.0.1') && !lines[i].includes(newHostname)) {
              // Add hostname to localhost line if not already there
              lines[i] = lines[i].replace('localhost', `localhost ${newHostname}`);
              updated = true;
            }
          }
        }
        
        // If no 127.0.1.1 entry found, add one
        if (!updated) {
          lines.splice(1, 0, `127.0.1.1\t${newHostname}`);
        }
        
        await fs.writeFile('/etc/hosts', lines.join('\n'));
        console.log('Updated /etc/hosts');
      } catch (e) {
        console.log('Could not update /etc/hosts:', e.message);
      }
      
      return { success: true, message: `Hostname updated to ${newHostname}. Reboot may be required for all changes to take effect.` };
    } catch (error) {
      console.error('Error updating hostname:', error);
      throw new Error(`Failed to update hostname: ${error.message}`);
    }
  }

  // WiFi network management methods
  async scanWifiNetworks(interfaceName) {
    if (!this.hasNmcli) {
      throw new Error('NetworkManager CLI not available for WiFi scanning');
    }

    try {
      console.log(`=== Scanning WiFi networks on ${interfaceName} ===`);
      
      // Rescan for networks first to get fresh data
      try {
        await execAsync(`nmcli device wifi rescan ifname ${interfaceName}`);
        // Wait a moment for the scan to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (e) {
        console.log('WiFi rescan failed, using cached results:', e.message);
      }
      
      // Get WiFi networks list
      const { stdout } = await execAsync(`nmcli -t -f SSID,BSSID,MODE,CHAN,FREQ,RATE,SIGNAL,SECURITY,ACTIVE device wifi list ifname ${interfaceName}`);
      
      console.log('WiFi scan output:', stdout);
      
      const networks = [];
      const lines = stdout.trim().split('\n');
      const seenSSIDs = new Set();
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const [ssid, bssid, mode, channel, frequency, rate, signal, security, active] = line.split(':');
        
        // Skip networks without SSID or duplicates (keep the strongest signal)
        if (!ssid || ssid.trim() === '' || seenSSIDs.has(ssid)) {
          continue;
        }
        
        seenSSIDs.add(ssid);
        
        // Parse security information
        const securityTypes = [];
        if (security) {
          if (security.includes('WPA3')) securityTypes.push('WPA3');
          if (security.includes('WPA2')) securityTypes.push('WPA2');
          if (security.includes('WPA1')) securityTypes.push('WPA1');
          if (security.includes('WEP')) securityTypes.push('WEP');
          if (security.includes('Enterprise')) securityTypes.push('Enterprise');
        }
        
        const isSecure = securityTypes.length > 0;
        const isConnected = active === 'yes';
        
        networks.push({
          ssid: ssid.trim(),
          bssid: bssid ? bssid.trim() : '',
          signal: signal ? parseInt(signal) : 0,
          frequency: frequency ? frequency.trim() : '',
          channel: channel ? channel.trim() : '',
          security: securityTypes.join(', ') || 'Open',
          isSecure,
          isConnected,
          mode: mode ? mode.trim() : 'Infra'
        });
      }
      
      // Sort by signal strength (descending)
      networks.sort((a, b) => b.signal - a.signal);
      
      console.log(`Found ${networks.length} WiFi networks:`, networks.map(n => `${n.ssid} (${n.signal}dBm)`));
      return networks;
    } catch (error) {
      console.error('Error scanning WiFi networks:', error);
      throw new Error(`Failed to scan WiFi networks: ${error.message}`);
    }
  }

  async connectToWifiNetwork(interfaceName, ssid, password = '', security = 'auto') {
    if (!this.hasNmcli) {
      throw new Error('NetworkManager CLI not available for WiFi connection');
    }

    try {
      console.log(`=== Connecting to WiFi network: ${ssid} on ${interfaceName} ===`);
      
      // Check if this is an open network (no password required)
      const isOpenNetwork = !password || password.trim() === '';
      
      if (isOpenNetwork) {
        console.log('Connecting to open WiFi network (no password)');
        await execAsync(`nmcli device wifi connect "${ssid}" ifname ${interfaceName}`);
      } else {
        console.log('Connecting to secured WiFi network with password');
        await execAsync(`nmcli device wifi connect "${ssid}" password "${password}" ifname ${interfaceName}`);
      }
      
      // Wait for connection to establish
      console.log('Waiting for connection to establish...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verify connection
      try {
        const { stdout: connectionCheck } = await execAsync(`nmcli -t -f ACTIVE,SSID device wifi list ifname ${interfaceName} | grep "^yes:"`);
        if (connectionCheck.includes(ssid)) {
          console.log(`Successfully connected to ${ssid}`);
          return { 
            success: true, 
            message: `Successfully connected to WiFi network "${ssid}"`,
            connectedSSID: ssid
          };
        } else {
          throw new Error('Connection verification failed');
        }
      } catch (verifyError) {
        console.log('Connection verification failed:', verifyError.message);
        // Still return success if the main command succeeded
        return { 
          success: true, 
          message: `WiFi connection initiated for "${ssid}". Please check connection status.`,
          connectedSSID: ssid
        };
      }
    } catch (error) {
      console.error('Error connecting to WiFi network:', error);
      
      // Provide more specific error messages
      let errorMessage = error.message;
      if (error.message.includes('Secrets were required')) {
        errorMessage = 'Invalid password or security configuration';
      } else if (error.message.includes('No network with SSID')) {
        errorMessage = `WiFi network "${ssid}" not found. Please scan for networks first.`;
      } else if (error.message.includes('device not found')) {
        errorMessage = `WiFi interface "${interfaceName}" not found or not available`;
      }
      
      throw new Error(`Failed to connect to WiFi network: ${errorMessage}`);
    }
  }

  async disconnectWifiNetwork(interfaceName) {
    if (!this.hasNmcli) {
      throw new Error('NetworkManager CLI not available for WiFi disconnection');
    }

    try {
      console.log(`=== Disconnecting WiFi on ${interfaceName} ===`);
      
      // Get current connection name
      let currentSSID = '';
      try {
        const { stdout: currentConnection } = await execAsync(`nmcli -t -f ACTIVE,SSID device wifi list ifname ${interfaceName} | grep "^yes:"`);
        if (currentConnection) {
          currentSSID = currentConnection.split(':')[1] || 'unknown network';
        }
      } catch (e) {
        console.log('Could not determine current WiFi network');
      }
      
      // Disconnect the device
      await execAsync(`nmcli device disconnect ${interfaceName}`);
      
      console.log(`WiFi disconnected from: ${currentSSID || 'network'}`);
      return { 
        success: true, 
        message: `WiFi disconnected${currentSSID ? ` from "${currentSSID}"` : ''}`,
        disconnectedSSID: currentSSID
      };
    } catch (error) {
      console.error('Error disconnecting WiFi:', error);
      throw new Error(`Failed to disconnect WiFi: ${error.message}`);
    }
  }

  async getWifiStatus(interfaceName) {
    if (!this.hasNmcli) {
      return { connected: false, ssid: '', signal: 0 };
    }

    try {
      console.log(`=== Getting WiFi status for ${interfaceName} ===`);
      
      // Get current WiFi connection status
      const { stdout: wifiList } = await execAsync(`nmcli -t -f ACTIVE,SSID,SIGNAL device wifi list ifname ${interfaceName}`);
      
      const lines = wifiList.split('\n');
      for (const line of lines) {
        const [active, ssid, signal] = line.split(':');
        if (active === 'yes' && ssid) {
          return {
            connected: true,
            ssid: ssid.trim(),
            signal: signal ? parseInt(signal) : 0
          };
        }
      }
      
      return { connected: false, ssid: '', signal: 0 };
    } catch (error) {
      console.log('Error getting WiFi status:', error.message);
      return { connected: false, ssid: '', signal: 0 };
    }
  }

  async forgetWifiNetwork(ssid) {
    if (!this.hasNmcli) {
      throw new Error('NetworkManager CLI not available');
    }

    try {
      console.log(`=== Forgetting WiFi network: ${ssid} ===`);
      
      // Find the connection UUID for this SSID
      const { stdout: connections } = await execAsync(`nmcli -t -f NAME,UUID,TYPE connection show`);
      const connectionLines = connections.split('\n');
      
      for (const line of connectionLines) {
        const [name, uuid, type] = line.split(':');
        if (name === ssid && type === '802-11-wireless') {
          console.log(`Found saved connection for ${ssid}, deleting...`);
          await execAsync(`nmcli connection delete uuid ${uuid}`);
          return { 
            success: true, 
            message: `WiFi network "${ssid}" forgotten successfully` 
          };
        }
      }
      
      throw new Error(`No saved connection found for WiFi network "${ssid}"`);
    } catch (error) {
      console.error('Error forgetting WiFi network:', error);
      throw new Error(`Failed to forget WiFi network: ${error.message}`);
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

// Firewall (UFW) endpoints
app.get('/api/network/firewall/status', async (req, res) => {
  try {
    const status = await networkManager.getFirewallStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting firewall status:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/network/firewall/enable', async (req, res) => {
  try {
    const result = await networkManager.enableFirewall();
    res.json(result);
  } catch (error) {
    console.error('Error enabling firewall:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/network/firewall/disable', async (req, res) => {
  try {
    const result = await networkManager.disableFirewall();
    res.json(result);
  } catch (error) {
    console.error('Error disabling firewall:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/network/firewall/reset', async (req, res) => {
  try {
    const result = await networkManager.resetFirewall();
    res.json(result);
  } catch (error) {
    console.error('Error resetting firewall:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/network/firewall/default', async (req, res) => {
  try {
    const { direction, policy } = req.body;
    
    if (!direction || !policy) {
      return res.status(400).json({ error: 'Direction and policy are required' });
    }
    
    const result = await networkManager.setDefaultPolicy(direction, policy);
    res.json(result);
  } catch (error) {
    console.error('Error setting default policy:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/network/firewall/rules', async (req, res) => {
  try {
    const ruleConfig = req.body;
    
    if (!ruleConfig.action) {
      return res.status(400).json({ error: 'Action is required for firewall rule' });
    }
    
    const result = await networkManager.addFirewallRule(ruleConfig);
    res.json(result);
  } catch (error) {
    console.error('Error adding firewall rule:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/network/firewall/rules/:ruleNumber', async (req, res) => {
  try {
    const { ruleNumber } = req.params;
    
    if (!ruleNumber || isNaN(ruleNumber)) {
      return res.status(400).json({ error: 'Valid rule number is required' });
    }
    
    const result = await networkManager.deleteFirewallRule(parseInt(ruleNumber));
    res.json(result);
  } catch (error) {
    console.error('Error deleting firewall rule:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/network/firewall/logs', async (req, res) => {
  try {
    const { lines } = req.query;
    const result = await networkManager.getFirewallLogs(lines ? parseInt(lines) : 50);
    res.json(result);
  } catch (error) {
    console.error('Error getting firewall logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// NTP Server management endpoints
app.get('/api/network/ntp', async (req, res) => {
  try {
    const ntpSettings = await networkManager.getNTPSettings();
    res.json(ntpSettings);
  } catch (error) {
    console.error('Error getting NTP settings:', error);
    res.status(500).json({ error: 'Failed to get NTP settings' });
  }
});

app.put('/api/network/ntp', async (req, res) => {
  try {
    const { primary, fallback } = req.body;
    
    const result = await networkManager.updateNTPSettings(primary, fallback);
    res.json(result);
  } catch (error) {
    console.error('Error updating NTP settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Browser settings management endpoints
app.get('/api/network/browser', async (req, res) => {
  try {
    const browserSettings = await networkManager.getBrowserSettings();
    res.json(browserSettings);
  } catch (error) {
    console.error('Error getting browser settings:', error);
    res.status(500).json({ error: 'Failed to get browser settings' });
  }
});

app.put('/api/network/browser', async (req, res) => {
  try {
    const { homepage, showHomeButton } = req.body;
    
    const result = await networkManager.updateBrowserSettings(homepage, showHomeButton);
    res.json(result);
  } catch (error) {
    console.error('Error updating browser settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// System hostname management endpoints
app.get('/api/network/hostname', async (req, res) => {
  try {
    const hostnameInfo = await networkManager.getHostname();
    res.json(hostnameInfo);
  } catch (error) {
    console.error('Error getting hostname:', error);
    res.status(500).json({ error: 'Failed to get hostname' });
  }
});

app.put('/api/network/hostname', async (req, res) => {
  try {
    const { newHostname } = req.body;
    
    const result = await networkManager.updateHostname(newHostname);
    res.json(result);
  } catch (error) {
    console.error('Error updating hostname:', error);
    res.status(500).json({ error: error.message });
  }
});

// WiFi network management endpoints
app.get('/api/network/wifi/:interfaceName/scan', async (req, res) => {
  try {
    const { interfaceName } = req.params;
    
    const networks = await networkManager.scanWifiNetworks(interfaceName);
    res.json({ networks });
  } catch (error) {
    console.error('Error scanning WiFi networks:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/network/wifi/:interfaceName/connect', async (req, res) => {
  try {
    const { interfaceName } = req.params;
    const { ssid, password, security } = req.body;
    
    if (!ssid) {
      return res.status(400).json({ error: 'SSID is required' });
    }
    
    const result = await networkManager.connectToWifiNetwork(interfaceName, ssid, password, security);
    res.json(result);
  } catch (error) {
    console.error('Error connecting to WiFi network:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/network/wifi/:interfaceName/disconnect', async (req, res) => {
  try {
    const { interfaceName } = req.params;
    
    const result = await networkManager.disconnectWifiNetwork(interfaceName);
    res.json(result);
  } catch (error) {
    console.error('Error disconnecting WiFi:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/network/wifi/:interfaceName/status', async (req, res) => {
  try {
    const { interfaceName } = req.params;
    
    const status = await networkManager.getWifiStatus(interfaceName);
    res.json(status);
  } catch (error) {
    console.error('Error getting WiFi status:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/network/wifi/forget/:ssid', async (req, res) => {
  try {
    const { ssid } = req.params;
    
    const result = await networkManager.forgetWifiNetwork(ssid);
    res.json(result);
  } catch (error) {
    console.error('Error forgetting WiFi network:', error);
    res.status(500).json({ error: error.message });
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