const fs = require('fs').promises;
const BaseManager = require('./BaseManager');

class DNSManager extends BaseManager {
  constructor() {
    super('DNSManager');
  }

  async getDNSSettings() {
    try {
      this.log('info', 'Getting DNS settings');
      
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
        this.log('debug', 'Reading global DNS from /etc/systemd/resolved.conf');
        const resolvedConf = await fs.readFile('/etc/systemd/resolved.conf', 'utf8');
        
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
              this.log('debug', 'Found global DNS in resolved.conf:', dnsServers);
            } else if ((cleanKey === 'Domains' || cleanKey === 'Domain') && cleanValue) {
              const domains = cleanValue.split(/\s+/).filter(Boolean);
              dnsSettings.global.searchDomains = domains;
              this.log('debug', 'Found global search domains in resolved.conf:', domains);
            }
          }
        }
      } catch (e) {
        this.log('warn', 'Could not read /etc/systemd/resolved.conf:', e.message);
        this.log('debug', 'Trying fallback methods...');
        
        // Fallback 1: Try systemd-resolve --status for runtime info
        try {
          const { stdout: resolveStatus } = await this.exec('systemd-resolve --status');
          this.log('debug', 'Using systemd-resolve --status as fallback');
          
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
              this.log('debug', 'Found global DNS servers from status:', dnsServers);
            }
            
            // Extract DNS Domain/Search domains
            const domainMatches = globalText.match(/DNS Domain:\s*([^\n]+)/);
            if (domainMatches) {
              const domains = domainMatches[1].trim().split(/\s+/).filter(Boolean);
              dnsSettings.global.searchDomains = domains;
              this.log('debug', 'Found global search domains from status:', domains);
            }
          }
        } catch (e2) {
          this.log('warn', 'systemd-resolve also failed, trying resolv.conf');
          
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
            this.log('debug', 'Fallback DNS from resolv.conf:', { nameservers, searchDomains });
          } catch (e3) {
            this.log('warn', 'Could not read resolv.conf either');
          }
        }
      }
      
      // Get per-interface DNS settings if using nmcli
      try {
        await this.exec('which nmcli');
        const { stdout: connections } = await this.exec('nmcli -t -f NAME,DEVICE connection show --active');
        const activeConnections = connections.split('\n').filter(Boolean);
        
        for (const conn of activeConnections) {
          const [name, device] = conn.split(':');
          if (device && device !== 'lo') {
            try {
              const { stdout: dnsInfo } = await this.exec(`nmcli -t -f ipv4.dns connection show "${name}"`);
              const dnsMatch = dnsInfo.match(/ipv4\.dns:\s*(.+)/);
              if (dnsMatch && dnsMatch[1].trim()) {
                const interfaceDns = dnsMatch[1].trim().split(',').map(s => s.trim());
                dnsSettings.interfaces[device] = {
                  primary: interfaceDns[0] || '',
                  secondary: interfaceDns[1] || ''
                };
              }
            } catch (e) {
              this.log('debug', `Could not get DNS for interface ${device}`);
            }
          }
        }
      } catch (e) {
        this.log('debug', 'nmcli not available or could not get interface-specific DNS settings');
      }
      
      this.log('debug', 'Final DNS settings:', JSON.stringify(dnsSettings, null, 2));
      return dnsSettings;
    } catch (error) {
      this.log('error', 'Error getting DNS settings:', error);
      throw new Error('Failed to get DNS settings');
    }
  }

  async updateGlobalDNS(primary, secondary, searchDomains = []) {
    try {
      this.log('info', `Updating global DNS: ${primary}, ${secondary}`, { searchDomains });
      
      // Update /etc/systemd/resolved.conf
      try {
        // Read current resolved.conf
        let resolvedConf = '';
        try {
          resolvedConf = await fs.readFile('/etc/systemd/resolved.conf', 'utf8');
        } catch (e) {
          this.log('warn', 'Could not read existing resolved.conf, creating new one');
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
          await this.exec('cp /etc/systemd/resolved.conf /etc/systemd/resolved.conf.backup');
        } catch (e) {
          this.log('warn', 'Could not backup resolved.conf');
        }
        
        // Write updated configuration
        await fs.writeFile('/etc/systemd/resolved.conf', newResolvedConf);
        this.log('debug', 'Updated /etc/systemd/resolved.conf');
        
        // Restart systemd-resolved service to apply changes
        await this.exec('systemctl restart systemd-resolved');
        this.log('debug', 'Restarted systemd-resolved service');
        
        // Give it a moment to restart
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (e) {
        this.log('error', 'Error updating resolved.conf:', e.message);
        throw new Error(`Failed to update global DNS configuration: ${e.message}`);
      }
      
      return { success: true, message: 'Global DNS settings updated successfully' };
    } catch (error) {
      this.log('error', 'Error updating global DNS settings:', error);
      throw new Error(`Failed to update global DNS settings: ${error.message}`);
    }
  }
}

module.exports = DNSManager; 