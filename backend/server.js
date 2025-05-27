const express = require('express');
const cors = require('cors');
const dbus = require('dbus-next');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// D-Bus connection
let systemBus;

// Initialize D-Bus connection
async function initDBus() {
  // Check if we're on Windows first, before attempting D-Bus connection
  if (process.platform === 'win32') {
    console.log('Windows detected - D-Bus not available, using fallback methods');
    return false;
  }
  
  try {
    systemBus = dbus.systemBus();
    console.log('D-Bus connection established');
    return true;
  } catch (error) {
    console.error('Failed to connect to D-Bus:', error.message);
    console.log('Falling back to system commands for network management');
    return false;
  }
}

// Network interface management using NetworkManager D-Bus
class NetworkManager {
  constructor() {
    this.nmProxy = null;
  }

  async init() {
    if (!systemBus) return false;
    
    try {
      const nmObject = await systemBus.getProxyObject('org.freedesktop.NetworkManager', '/org/freedesktop/NetworkManager');
      this.nmProxy = nmObject.getInterface('org.freedesktop.NetworkManager');
      return true;
    } catch (error) {
      console.error('Failed to get NetworkManager proxy:', error.message);
      return false;
    }
  }

  async getDevices() {
    if (!this.nmProxy) {
      // Fallback to system commands
      return await this.getDevicesFallback();
    }

    try {
      const devicePaths = await this.nmProxy.GetDevices();
      const devices = [];

      for (const devicePath of devicePaths) {
        try {
          const deviceObject = await systemBus.getProxyObject('org.freedesktop.NetworkManager', devicePath);
          const deviceInterface = deviceObject.getInterface('org.freedesktop.NetworkManager.Device');
          
          const [interface_name, deviceType, state, activeConnection] = await Promise.all([
            deviceInterface.Interface,
            deviceInterface.DeviceType,
            deviceInterface.State,
            deviceInterface.ActiveConnection
          ]);

          // Get IP configuration if device is active
          let ipConfig = null;
          if (activeConnection && activeConnection !== '/') {
            ipConfig = await this.getIPConfig(devicePath);
          }

          devices.push({
            id: devicePath.split('/').pop(),
            name: interface_name,
            type: this.getDeviceTypeString(deviceType),
            state: this.getStateString(state),
            path: devicePath,
            ...ipConfig
          });
        } catch (error) {
          console.error(`Error getting device info for ${devicePath}:`, error.message);
        }
      }

      return devices;
    } catch (error) {
      console.error('Error getting devices:', error.message);
      return await this.getDevicesFallback();
    }
  }

  async getIPConfig(devicePath) {
    try {
      const deviceObject = await systemBus.getProxyObject('org.freedesktop.NetworkManager', devicePath);
      const deviceInterface = deviceObject.getInterface('org.freedesktop.NetworkManager.Device');
      
      const ip4ConfigPath = await deviceInterface.Ip4Config;
      if (!ip4ConfigPath || ip4ConfigPath === '/') {
        return {
          ip: '',
          netmask: '',
          gateway: '',
          dns: []
        };
      }

      const ip4Object = await systemBus.getProxyObject('org.freedesktop.NetworkManager', ip4ConfigPath);
      const ip4Interface = ip4Object.getInterface('org.freedesktop.NetworkManager.IP4Config');
      
      const [addresses, gateway, nameservers] = await Promise.all([
        ip4Interface.Addresses,
        ip4Interface.Gateway,
        ip4Interface.Nameservers
      ]);

      const ip = addresses.length > 0 ? this.intToIP(addresses[0][0]) : '';
      const prefix = addresses.length > 0 ? addresses[0][1] : 24;
      const netmask = this.prefixToNetmask(prefix);
      const dns = nameservers.map(ns => this.intToIP(ns));

      return {
        ip,
        netmask,
        gateway: gateway || '',
        dns
      };
    } catch (error) {
      console.error('Error getting IP config:', error.message);
      return {
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
      const { stdout } = await execAsync('ip -j addr show');
      const interfaces = JSON.parse(stdout);
      
      const devices = [];
      for (const iface of interfaces) {
        if (iface.ifname === 'lo') continue; // Skip loopback
        
        const addr_info = iface.addr_info || [];
        const ipv4 = addr_info.find(addr => addr.family === 'inet');
        
        devices.push({
          id: iface.ifindex.toString(),
          name: iface.ifname,
          type: this.guessInterfaceType(iface.ifname),
          state: iface.flags.includes('UP') ? 'activated' : 'disconnected',
          mac: iface.address || '',
          ip: ipv4 ? ipv4.local : '',
          netmask: ipv4 ? this.prefixToNetmask(ipv4.prefixlen) : '',
          gateway: await this.getGateway(iface.ifname),
          dns: await this.getDNS()
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
      const { stdout } = await execAsync(`ip route show dev ${interface_name} | grep default`);
      const match = stdout.match(/default via (\d+\.\d+\.\d+\.\d+)/);
      return match ? match[1] : '';
    } catch (error) {
      return '';
    }
  }

  async getDNS() {
    try {
      const data = await fs.readFile('/etc/resolv.conf', 'utf8');
      const nameservers = data.split('\n')
        .filter(line => line.startsWith('nameserver'))
        .map(line => line.split(' ')[1])
        .filter(Boolean);
      return nameservers;
    } catch (error) {
      return [];
    }
  }

  guessInterfaceType(name) {
    if (name.startsWith('eth') || name.startsWith('en')) return 'ethernet';
    if (name.startsWith('wl') || name.startsWith('wlan')) return 'wifi';
    return 'unknown';
  }

  getDeviceTypeString(type) {
    const types = {
      1: 'ethernet',
      2: 'wifi',
      5: 'bluetooth',
      14: 'generic'
    };
    return types[type] || 'unknown';
  }

  getStateString(state) {
    const states = {
      10: 'unmanaged',
      20: 'unavailable',
      30: 'disconnected',
      40: 'prepare',
      50: 'config',
      60: 'need_auth',
      70: 'ip_config',
      80: 'ip_check',
      90: 'secondaries',
      100: 'activated',
      110: 'deactivating',
      120: 'failed'
    };
    return states[state] || 'unknown';
  }

  intToIP(int) {
    return [
      (int >>> 24) & 0xFF,
      (int >>> 16) & 0xFF,
      (int >>> 8) & 0xFF,
      int & 0xFF
    ].join('.');
  }

  prefixToNetmask(prefix) {
    const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
    return this.intToIP(mask);
  }

  netmaskToPrefix(netmask) {
    const parts = netmask.split('.').map(Number);
    let binaryString = '';
    for (const part of parts) {
      binaryString += part.toString(2).padStart(8, '0');
    }
    return binaryString.indexOf('0') === -1 ? 32 : binaryString.indexOf('0');
  }
}

// Initialize NetworkManager
const networkManager = new NetworkManager();

// Routes
app.get('/api/network/interfaces', async (req, res) => {
  try {
    const devices = await networkManager.getDevices();
    
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

    res.json({ interfaces });
  } catch (error) {
    console.error('Error getting interfaces:', error);
    res.status(500).json({ error: 'Failed to get network interfaces' });
  }
});

app.get('/api/network/routing', async (req, res) => {
  try {
    const { stdout } = await execAsync('ip route show');
    const routes = stdout.split('\n')
      .filter(line => line.trim())
      .map((line, index) => {
        const parts = line.split(' ');
        const destination = parts[0] === 'default' ? '0.0.0.0/0' : parts[0];
        const gatewayIndex = parts.indexOf('via');
        const devIndex = parts.indexOf('dev');
        const metricIndex = parts.indexOf('metric');
        
        return {
          id: (index + 1).toString(),
          destination,
          gateway: gatewayIndex !== -1 ? parts[gatewayIndex + 1] : '',
          interface: devIndex !== -1 ? parts[devIndex + 1] : '',
          metric: metricIndex !== -1 ? parseInt(parts[metricIndex + 1]) : 0,
          enabled: true
        };
      });

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
    const device = devices.find(d => d.id === id);
    
    if (!device) {
      return res.status(404).json({ error: 'Interface not found' });
    }

    const action = device.state === 'activated' ? 'down' : 'up';
    await execAsync(`sudo ip link set ${device.name} ${action}`);
    
    res.json({ success: true, message: `Interface ${device.name} ${action}` });
  } catch (error) {
    console.error('Error toggling interface:', error);
    res.status(500).json({ error: 'Failed to toggle interface' });
  }
});

app.put('/api/network/interfaces/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { address, netmask, gateway, dns1, dns2 } = req.body;
    
    const devices = await networkManager.getDevices();
    const device = devices.find(d => d.id === id);
    
    if (!device) {
      return res.status(404).json({ error: 'Interface not found' });
    }

    // Configure IP address
    if (address && netmask) {
      const prefix = networkManager.netmaskToPrefix(netmask);
      await execAsync(`sudo ip addr flush dev ${device.name}`);
      await execAsync(`sudo ip addr add ${address}/${prefix} dev ${device.name}`);
    }

    // Configure gateway
    if (gateway) {
      try {
        await execAsync(`sudo ip route del default dev ${device.name}`);
      } catch (e) {
        // Ignore if no default route exists
      }
      await execAsync(`sudo ip route add default via ${gateway} dev ${device.name}`);
    }

    res.json({ success: true, message: 'Interface configured successfully' });
  } catch (error) {
    console.error('Error configuring interface:', error);
    res.status(500).json({ error: 'Failed to configure interface' });
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
    await initDBus();
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