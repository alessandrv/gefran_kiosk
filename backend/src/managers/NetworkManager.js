const fs = require('fs').promises;
const BaseManager = require('./BaseManager');
const { mapDeviceType, mapDeviceState, guessInterfaceType, prefixToNetmask, netmaskToPrefix } = require('../utils/helpers');

class NetworkManager extends BaseManager {
  constructor() {
    super('NetworkManager');
    this.hasNmcli = false;
  }

  async init() {
    try {
      // Check if nmcli is available
      await this.execAsync('which nmcli');
      await this.execAsync('nmcli --version');
      this.hasNmcli = true;
      this.logger.info('NetworkManager CLI (nmcli) is available');
      
      // Clean up any duplicate connections from previous runs
      await this.cleanupDuplicateConnections();
      
      return true;
    } catch (error) {
      this.logger.info('nmcli not available, using system commands only');
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
      const { stdout: deviceOutput } = await this.execAsync('nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status');
      const { stdout: connectionOutput } = await this.execAsync('nmcli -t -f NAME,UUID,TYPE,DEVICE connection show --active');
      
      this.logger.debug('nmcli device output:', deviceOutput);
      this.logger.debug('nmcli connection output:', connectionOutput);
      
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
          type: mapDeviceType(deviceType),
          state: mapDeviceState(state),
          connection: connection || '',
          ...deviceInfo
        });
      }
      
      this.logger.debug('nmcli devices extracted:', JSON.stringify(devices, null, 2));
      return devices;
    } catch (error) {
      this.logger.error('Error getting devices via nmcli:', error.message);
      return await this.getDevicesFallback();
    }
  }

  async getDeviceDetails(deviceName) {
    try {
      // Get hardware address and other details
      const { stdout: hwOutput } = await this.execAsync(`nmcli -t -f GENERAL.HWADDR device show ${deviceName}`);
      const { stdout: ipOutput } = await this.execAsync(`nmcli -t -f IP4.ADDRESS,IP4.GATEWAY,IP4.DNS device show ${deviceName}`);
      
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
              netmask = prefixToNetmask(parseInt(addressParts[1]));
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
        const { stdout: activeConnInfo } = await this.execAsync(`nmcli -t -f NAME,DEVICE connection show --active | grep ":${deviceName}$"`);
        if (activeConnInfo.trim()) {
          const activeConnection = activeConnInfo.split(':')[0];
          const { stdout: methodOutput } = await this.execAsync(`nmcli -t -f ipv4.method connection show "${activeConnection}"`);
          const methodMatch = methodOutput.match(/ipv4\.method:(.+)/);
          if (methodMatch) {
            ipMethod = methodMatch[1].trim();
          }
        }
      } catch (e) {
        this.logger.debug(`Could not get IP method for ${deviceName}:`, e.message);
      }
      
      return {
        id: deviceName,
        mac: mac,
        ip: ip,
        netmask: netmask,
        gateway: gateway,
        dns: dns,
        ipMethod: ipMethod
      };
    } catch (error) {
      this.logger.error(`Error getting details for ${deviceName}:`, error.message);
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
      const { stdout: addrOutput } = await this.execAsync('ip -j addr show');
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
          type: guessInterfaceType(iface.ifname),
          state: isUp && hasCarrier ? 'activated' : 'disconnected',
          mac: macAddress,
          ip: ipv4 ? ipv4.local : '',
          netmask: ipv4 ? prefixToNetmask(ipv4.prefixlen) : '',
          gateway: gateway,
          dns: dns
        });
      }
      
      return devices;
    } catch (error) {
      this.logger.error('Error in fallback method:', error.message);
      return [];
    }
  }

  async getGateway(interface_name) {
    try {
      // Get default route for this interface
      const { stdout } = await this.execAsync(`ip route show dev ${interface_name} default`);
      if (stdout.trim()) {
        const match = stdout.match(/default via (\d+\.\d+\.\d+\.\d+)/);
        return match ? match[1] : '';
      }
      
      // If no interface-specific default route, get global default
      const { stdout: globalRoute } = await this.execAsync('ip route show default');
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
        const { stdout } = await this.execAsync('systemd-resolve --status | grep "DNS Servers"');
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

  // Network configuration methods
  async configureInterface(deviceName, config) {
    if (!this.hasNmcli) {
      throw new Error('NetworkManager CLI not available for configuration');
    }

    try {
      const { address, netmask, gateway, dns1, dns2 } = config;
      
      this.logger.info(`=== Configuring interface ${deviceName} ===`);
      this.logger.debug(`New config:`, { address, netmask, gateway, dns1, dns2 });
      
      // Find the active connection for this device
      let activeConnection = null;
      try {
        const { stdout: activeConnInfo } = await this.execAsync(`nmcli -t -f NAME,DEVICE connection show --active | grep ":${deviceName}$"`);
        if (activeConnInfo.trim()) {
          activeConnection = activeConnInfo.split(':')[0];
          this.logger.debug(`Found active connection for ${deviceName}: ${activeConnection}`);
        }
      } catch (e) {
        this.logger.debug(`No active connection found for ${deviceName}`);
      }
      
      // If no active connection, find any connection assigned to this device
      if (!activeConnection) {
        try {
          const { stdout: deviceConnInfo } = await this.execAsync(`nmcli -t -f NAME,DEVICE connection show | grep ":${deviceName}$"`);
          if (deviceConnInfo.trim()) {
            activeConnection = deviceConnInfo.split(':')[0];
            this.logger.debug(`Found assigned connection for ${deviceName}: ${activeConnection}`);
          }
        } catch (e) {
          this.logger.debug(`No assigned connection found for ${deviceName}`);
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
        const prefix = netmaskToPrefix(netmask);
        modifyCmd += ` ipv4.method manual ipv4.addresses "${address}/${prefix}"`;
        
        // Set gateway for static IP
        if (gateway) {
          modifyCmd += ` ipv4.gateway "${gateway}"`;
        } else {
          modifyCmd += ` ipv4.gateway ""`;
        }
        
        this.logger.debug(`Configuring static IP: ${address}/${prefix}`);
      } else {
        // DHCP configuration - clear static settings
        modifyCmd += ` ipv4.method auto ipv4.addresses "" ipv4.gateway ""`;
        this.logger.debug(`Configuring DHCP (automatic IP)`);
      }
      
      // Handle DNS settings (independent of IP method)
      if (dns1 || dns2) {
        const dnsServers = [dns1, dns2].filter(Boolean).join(',');
        modifyCmd += ` ipv4.dns "${dnsServers}"`;
        modifyCmd += ` ipv4.ignore-auto-dns yes`;
        this.logger.debug(`Setting interface-specific DNS: ${dnsServers}`);
      } else {
        modifyCmd += ` ipv4.dns ""`;
        modifyCmd += ` ipv4.ignore-auto-dns no`;
        this.logger.debug(`Clearing interface-specific DNS (will use global/DHCP DNS)`);
      }
      
      this.logger.debug(`Modifying connection with command: ${modifyCmd}`);
      await this.execAsync(modifyCmd);
      
      // Reactivate the connection to apply changes
      this.logger.debug(`Reactivating connection: ${activeConnection}`);
      await this.execAsync(`nmcli connection up "${activeConnection}"`);
      
      // Wait a moment for the connection to stabilize
      await this.sleep(2000);
      
      return { success: true, message: `Interface ${deviceName} configured successfully` };
    } catch (error) {
      this.logger.error('Error configuring interface:', error);
      throw error;
    }
  }

  async toggleInterface(deviceName) {
    if (!this.hasNmcli) {
      throw new Error('NetworkManager CLI not available for interface control');
    }

    try {
      // Get current state
      const { stdout } = await this.execAsync(`nmcli -t -f DEVICE,STATE device status | grep "^${deviceName}:"`);
      const state = stdout.split(':')[1];
      
      this.logger.debug(`Current state of ${deviceName}: ${state}`);
      
      if (state === 'connected') {
        this.logger.debug(`Disconnecting ${deviceName}`);
        await this.execAsync(`nmcli device disconnect "${deviceName}"`);
        return { success: true, message: `Interface ${deviceName} disconnected` };
      } else if (state === 'disconnected' || state === 'unavailable') {
        this.logger.debug(`Connecting ${deviceName}`);
        
        // For WiFi interfaces, we might need to connect to a specific network
        const { stdout: deviceInfo } = await this.execAsync(`nmcli -t -f DEVICE,TYPE device status | grep "^${deviceName}:"`);
        const deviceType = deviceInfo.split(':')[1];
        
        if (deviceType === 'wifi') {
          // Try to connect to the most recent/available connection
          try {
            const { stdout: connections } = await this.execAsync(`nmcli -t -f NAME,DEVICE connection show | grep ":${deviceName}$"`);
            if (connections.trim()) {
              const connectionName = connections.trim().split('\n')[0].split(':')[0];
              this.logger.debug(`Connecting WiFi using connection: ${connectionName}`);
              await this.execAsync(`nmcli connection up "${connectionName}"`);
            } else {
              // No saved connections, try to connect to available networks
              await this.execAsync(`nmcli device wifi connect --ask`);
            }
          } catch (e) {
            this.logger.debug('WiFi connection failed, trying generic device connect');
            await this.execAsync(`nmcli device connect "${deviceName}"`);
          }
        } else {
          // For ethernet and other types, simple connect
          await this.execAsync(`nmcli device connect "${deviceName}"`);
        }
        
        return { success: true, message: `Interface ${deviceName} connected` };
      } else {
        return { success: false, message: `Interface ${deviceName} is in state: ${state}` };
      }
    } catch (error) {
      this.logger.error('Error toggling interface:', error);
      throw error;
    }
  }

  // Clean up duplicate connections created by old approach
  async cleanupDuplicateConnections() {
    if (!this.hasNmcli) {
      return;
    }

    try {
      this.logger.info('=== Cleaning up duplicate static connections ===');
      
      // Find all connections that start with "static-"
      const { stdout: allConnections } = await this.execAsync('nmcli -t -f NAME,DEVICE,TYPE connection show');
      const connections = allConnections.split('\n').filter(Boolean);
      
      for (const conn of connections) {
        const [name, device, type] = conn.split(':');
        
        // Remove static-* connections that are duplicates
        if (name.startsWith('static-')) {
          this.logger.debug(`Found duplicate static connection: ${name} for device ${device}`);
          
          // Check if there's already an active connection for this device
          try {
            const { stdout: activeConn } = await this.execAsync(`nmcli -t -f NAME,DEVICE connection show --active | grep ":${device}$"`);
            if (activeConn.trim()) {
              const activeName = activeConn.split(':')[0];
              if (activeName !== name) {
                this.logger.debug(`Removing duplicate connection ${name} (active connection is ${activeName})`);
                await this.execAsync(`nmcli connection delete "${name}"`);
              }
            }
          } catch (e) {
            // If no active connection, keep the static one but log it
            this.logger.debug(`No active connection for ${device}, keeping ${name}`);
          }
        }
      }
    } catch (error) {
      this.logger.debug('Error during cleanup:', error.message);
    }
  }
}

module.exports = NetworkManager; 