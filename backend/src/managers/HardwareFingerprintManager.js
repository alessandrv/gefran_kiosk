const crypto = require('crypto');
const BaseManager = require('./BaseManager');

class HardwareFingerprintManager extends BaseManager {
  constructor(authorizedFingerprint) {
    super('HardwareFingerprint');
    this.authorizedFingerprint = authorizedFingerprint;
  }

  async generateFingerprint() {
    try {
      this.log('info', 'Generating hardware fingerprint...');
      
      let cpuModel = '';
      let cpuArchitecture = '';
      let biosVendor = '';
      let biosVersion = '';
      let gpuModel = '';
      let ethernetController = '';
      let networkController = '';
      
      // Get CPU model (stable identifier)
      try {
        const { stdout: cpuInfo } = await this.exec('cat /proc/cpuinfo | grep "model name" | head -1');
        const cpuMatch = cpuInfo.match(/model name\s*:\s*(.+)/);
        if (cpuMatch) {
          cpuModel = cpuMatch[1].trim().replace(/\s+/g, ' '); // Normalize spaces
        }
      } catch (e) {
        this.log('warn', 'Could not get CPU model:', e.message);
      }
      
      // Get CPU architecture
      try {
        const { stdout: archInfo } = await this.exec('uname -m');
        cpuArchitecture = archInfo.trim();
      } catch (e) {
        this.log('warn', 'Could not get CPU architecture:', e.message);
      }
      
      // Get BIOS vendor (very stable)
      try {
        const { stdout: biosVendorInfo } = await this.exec('cat /sys/class/dmi/id/bios_vendor 2>/dev/null || echo "unknown"');
        biosVendor = biosVendorInfo.trim();
      } catch (e) {
        this.log('warn', 'Could not get BIOS vendor:', e.message);
      }
      
      // Get BIOS version (stable)
      try {
        const { stdout: biosVersionInfo } = await this.exec('cat /sys/class/dmi/id/bios_version 2>/dev/null || echo "unknown"');
        biosVersion = biosVersionInfo.trim();
      } catch (e) {
        this.log('warn', 'Could not get BIOS version:', e.message);
      }
      
      // Get GPU model (stable when not removable)
      try {
        const { stdout: gpuInfo } = await this.exec('lspci | grep -E "(VGA|3D)" | head -1');
        const gpuMatch = gpuInfo.match(/:\s*(.+?)(?:\s*\[|\s*$)/);
        if (gpuMatch) {
          gpuModel = gpuMatch[1].trim();
        }
      } catch (e) {
        this.log('warn', 'Could not get GPU model:', e.message);
      }
      
      // Get Ethernet controller (very stable and hardware-specific)
      try {
        const { stdout: ethInfo } = await this.exec('lspci | grep -i ethernet | head -1');
        const ethMatch = ethInfo.match(/:\s*(.+?)(?:\s*\[|\s*$)/);
        if (ethMatch) {
          ethernetController = ethMatch[1].trim();
        }
      } catch (e) {
        this.log('warn', 'Could not get Ethernet controller:', e.message);
      }
      
      // Get Network controller (includes WiFi, additional network hardware)
      try {
        const { stdout: netInfo } = await this.exec('lspci | grep -i network | head -1');
        const netMatch = netInfo.match(/:\s*(.+?)(?:\s*\[|\s*$)/);
        if (netMatch) {
          networkController = netMatch[1].trim();
        }
      } catch (e) {
        this.log('warn', 'Could not get Network controller:', e.message);
      }
      
      // Create fingerprint string using stable components
      const fingerprint = `${cpuModel}_${cpuArchitecture}_${biosVendor}_${biosVersion}_${gpuModel}_${ethernetController}_${networkController}`;
      
      this.log('debug', 'Hardware fingerprint components:', {
        cpuModel,
        cpuArchitecture,
        biosVendor,
        biosVersion,
        gpuModel,
        ethernetController,
        networkController
      });
      
      // Generate SHA256 hash
      const hash = crypto.createHash('sha256').update(fingerprint).digest('hex');
      this.log('debug', 'Generated fingerprint hash:', hash);
      
      return hash;
    } catch (error) {
      this.log('error', 'Error generating hardware fingerprint:', error);
      return null;
    }
  }
  
  async verifyAuthorization() {
    try {
      const currentFingerprint = await this.generateFingerprint();
      
      if (!currentFingerprint) {
        this.log('error', 'Could not generate hardware fingerprint');
        return false;
      }
      
      if (currentFingerprint === this.authorizedFingerprint) {
        this.log('info', 'Hardware authorization successful');
        return true;
      } else {
        this.log('error', 'Unauthorized hardware detected');
        this.log('error', `Expected: ${this.authorizedFingerprint}`);
        this.log('error', `Current:  ${currentFingerprint}`);
        return false;
      }
    } catch (error) {
      this.log('error', 'Hardware verification failed:', error);
      return false;
    }
  }

  getCurrentFingerprint() {
    return this.generateFingerprint();
  }

  getAuthorizedFingerprint() {
    return this.authorizedFingerprint;
  }
}

module.exports = HardwareFingerprintManager; 