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
      
      return {
        id: deviceName,
        mac: mac,
        ip: ip,
        netmask: netmask,
        gateway: gateway,
        dns: dns
      };
    } catch (error) {
      console.error(`Error getting details for ${deviceName}:`, error.message);
      return {
        id: deviceName,
        mac: '',
        ip: '',
        netmask: '',
        gateway: '',
        dns: []
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
      
      // Get device type to determine connection type
      const { stdout: deviceInfo } = await execAsync(`nmcli -t -f DEVICE,TYPE device status | grep "^${deviceName}:"`);
      const rawDeviceType = deviceInfo.split(':')[1].trim(); // Remove any whitespace/newlines
      
      console.log(`Device ${deviceName} raw type from nmcli: "${rawDeviceType}"`);
      
      // Determine connection type based on device type
      // nmcli might return 'wifi', 'wireless', or other variants
      let connectionType = 'ethernet';
      const lowerType = rawDeviceType.toLowerCase();
      if (lowerType === 'wifi' || lowerType === 'wireless' || lowerType.includes('wifi') || lowerType.includes('wireless')) {
        connectionType = 'wifi';
      }
      
      console.log(`Will create ${connectionType} connection for ${deviceName} (detected from type: ${rawDeviceType})`);
      
      // For WiFi, get the SSID BEFORE cleanup (while still connected)
      let currentSSID = null;
      if (connectionType === 'wifi') {
        try {
          // Try to get current SSID from active connection first
          const { stdout: activeConnInfo } = await execAsync(`nmcli -t -f NAME,DEVICE,TYPE connection show --active | grep ":${deviceName}:"`);
          if (activeConnInfo.trim()) {
            const activeConnName = activeConnInfo.split(':')[0];
            console.log(`Found active WiFi connection: ${activeConnName}`);
            
            // Get SSID from the active connection
            try {
              const { stdout: ssidInfo } = await execAsync(`nmcli -t -f 802-11-wireless.ssid connection show "${activeConnName}"`);
              const ssidMatch = ssidInfo.match(/802-11-wireless\.ssid:(.+)/);
              if (ssidMatch) {
                currentSSID = ssidMatch[1].trim();
                console.log(`Current WiFi SSID from active connection: ${currentSSID}`);
              }
            } catch (e) {
              console.log('Could not get SSID from active connection');
            }
          }
          
          // If we couldn't get SSID from connection, try device wifi list
          if (!currentSSID) {
            try {
              const { stdout: wifiInfo } = await execAsync(`nmcli -t -f ACTIVE,SSID device wifi list ifname ${deviceName} | grep "^yes:"`);
              currentSSID = wifiInfo.split(':')[1];
              console.log(`Current WiFi SSID from device list: ${currentSSID}`);
            } catch (e) {
              console.log('Could not get SSID from device wifi list');
            }
          }
          
          // If still no SSID, try to get any available networks
          if (!currentSSID) {
            try {
              const { stdout: availableNetworks } = await execAsync(`nmcli -t -f SSID device wifi list ifname ${deviceName} | head -5`);
              const networks = availableNetworks.split('\n').filter(Boolean);
              if (networks.length > 0) {
                console.log(`Available WiFi networks: ${networks.join(', ')}`);
                console.log('No current SSID found. You may need to connect to a WiFi network first.');
              }
            } catch (e) {
              console.log('Could not list available WiFi networks');
            }
          }
        } catch (e) {
          console.log('Error getting WiFi SSID before cleanup:', e.message);
        }
      }
      
      // List ALL existing connections to see what's there
      console.log('=== All existing connections ===');
      try {
        const { stdout: allConnections } = await execAsync('nmcli -t -f NAME,DEVICE,TYPE connection show');
        console.log('All connections:', allConnections);
        
        // Also show active connections
        const { stdout: activeConnections } = await execAsync('nmcli -t -f NAME,DEVICE,TYPE connection show --active');
        console.log('Active connections:', activeConnections);
      } catch (e) {
        console.log('Could not list all connections:', e.message);
      }
      
      // Create or modify connection
      const connectionName = `static-${deviceName}`;
      
      // More thorough cleanup - remove ANY connection that might conflict
      console.log('=== Cleaning up existing connections ===');
      
      // 1. Remove any connection with our target name
      try {
        await execAsync(`nmcli connection delete "${connectionName}"`);
        console.log(`Deleted existing connection: ${connectionName}`);
      } catch (e) {
        console.log(`No connection named ${connectionName} to delete`);
      }
      
      // 2. Remove any connection assigned to this device
      try {
        const { stdout: deviceConnections } = await execAsync(`nmcli -t -f NAME,DEVICE connection show | grep ":${deviceName}$"`);
        const connections = deviceConnections.trim().split('\n').filter(Boolean);
        
        for (const conn of connections) {
          const connName = conn.split(':')[0];
          console.log(`Removing device connection: ${connName} (assigned to ${deviceName})`);
          await execAsync(`nmcli connection delete "${connName}"`);
        }
      } catch (e) {
        console.log(`No device-specific connections for ${deviceName}`);
      }
      
      // 3. For WiFi, also remove any connections that might be using the same SSID
      if (connectionType === 'wifi' && currentSSID) {
        try {
          // Find connections with this SSID
          const { stdout: ssidConnections } = await execAsync(`nmcli -t -f NAME,802-11-wireless.ssid connection show | grep ":${currentSSID}$"`);
          const ssidConns = ssidConnections.trim().split('\n').filter(Boolean);
          
          for (const conn of ssidConns) {
            const connName = conn.split(':')[0];
            console.log(`Removing SSID connection: ${connName} (SSID: ${currentSSID})`);
            await execAsync(`nmcli connection delete "${connName}"`);
          }
        } catch (e) {
          console.log(`No existing connections for SSID ${currentSSID}`);
        }
      }
      
      // Wait a moment for NetworkManager to process the deletions
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // List connections again to verify cleanup
      console.log('=== Connections after cleanup ===');
      try {
        const { stdout: afterCleanup } = await execAsync('nmcli -t -f NAME,DEVICE,TYPE connection show');
        console.log('Remaining connections:', afterCleanup);
      } catch (e) {
        console.log('Could not list connections after cleanup');
      }
      
      // Create new connection with proper type
      let cmd = `nmcli connection add type ${connectionType} con-name "${connectionName}" ifname "${deviceName}"`;
      
      // For WiFi, we need to handle it differently
      if (connectionType === 'wifi') {
        if (currentSSID) {
          cmd = `nmcli connection add type wifi con-name "${connectionName}" ifname "${deviceName}" ssid "${currentSSID}"`;
          console.log(`Creating WiFi connection for SSID: ${currentSSID}`);
        } else {
          throw new Error('WiFi interface configuration requires an active WiFi connection. Please connect to a WiFi network first, then try configuring the static IP.');
        }
      }
      
      // Add IP configuration
      cmd += ` ipv4.method manual`;
      
      if (address && netmask) {
        const prefix = this.netmaskToPrefix(netmask);
        cmd += ` ipv4.addresses "${address}/${prefix}"`;
      }
      
      if (gateway) {
        cmd += ` ipv4.gateway "${gateway}"`;
      }
      
      if (dns1 || dns2) {
        const dnsServers = [dns1, dns2].filter(Boolean).join(',');
        cmd += ` ipv4.dns "${dnsServers}"`;
      }
      
      console.log(`Creating connection with command: ${cmd}`);
      await execAsync(cmd);
      
      // Verify the connection was created
      console.log('=== Verifying new connection ===');
      try {
        const { stdout: newConn } = await execAsync(`nmcli connection show "${connectionName}"`);
        console.log(`Connection ${connectionName} created successfully`);
      } catch (e) {
        console.log('Failed to verify new connection:', e.message);
      }
      
      // Activate the connection
      console.log(`Activating connection: ${connectionName}`);
      await execAsync(`nmcli connection up "${connectionName}"`);
      
      return { success: true, message: 'Interface configured successfully' };
    } catch (error) {
      console.error('Error configuring interface:', error);
      console.error('Full error details:', error);
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
      type: device.state === 'activated' ? 'Static' : 'DHCP', // Simplified for now
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
    const { stdout } = await execAsync('ip route show');
    console.log('Raw route output:', stdout);
    
    const routes = stdout.split('\n')
      .filter(line => line.trim())
      .map((line, index) => {
        const parts = line.trim().split(/\s+/);
        
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
        
        return {
          id: (index + 1).toString(),
          destination,
          gateway: gatewayIndex !== -1 ? parts[gatewayIndex + 1] : '',
          interface: devIndex !== -1 ? parts[devIndex + 1] : '',
          metric: metricIndex !== -1 ? parseInt(parts[metricIndex + 1]) : 0,
          protocol: protoIndex !== -1 ? parts[protoIndex + 1] : '',
          enabled: true
        };
      })
      .filter(route => route.destination && route.interface); // Filter out invalid routes

    console.log('Parsed routes:', JSON.stringify(routes, null, 2));
    res.json({ routes });
  } catch (error) {
    console.error('Error getting routing table:', error);
    res.status(500).json({ error: 'Failed to get routing table' });
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