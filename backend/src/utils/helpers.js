class NetworkHelpers {
  static mapDeviceType(nmcliType) {
    const typeMap = {
      'ethernet': 'ethernet',
      'wifi': 'wifi',
      'wireless': 'wifi',
      'bridge': 'bridge',
      'loopback': 'loopback',
      'tun': 'vpn',
      'tap': 'vpn'
    };
    return typeMap[nmcliType] || 'unknown';
  }

  static mapDeviceState(nmcliState) {
    const stateMap = {
      'activated': 'activated',
      'connected': 'activated',
      'disconnected': 'disconnected',
      'unavailable': 'unavailable',
      'unmanaged': 'unmanaged',
      'deactivating': 'deactivating',
      'activating': 'activating'
    };
    return stateMap[nmcliState] || nmcliState;
  }

  static guessInterfaceType(name) {
    if (name.startsWith('eth') || name.startsWith('en')) return 'ethernet';
    if (name.startsWith('wlan') || name.startsWith('wl') || name.startsWith('wifi')) return 'wifi';
    if (name.startsWith('lo')) return 'loopback';
    if (name.startsWith('br')) return 'bridge';
    if (name.startsWith('tun') || name.startsWith('tap')) return 'vpn';
    return 'unknown';
  }

  static prefixToNetmask(prefix) {
    if (!prefix || prefix === '') return '';
    const prefixNum = parseInt(prefix);
    if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 32) return '';
    
    const mask = 0xFFFFFFFF << (32 - prefixNum);
    return [
      (mask >>> 24) & 0xFF,
      (mask >>> 16) & 0xFF,
      (mask >>> 8) & 0xFF,
      mask & 0xFF
    ].join('.');
  }

  static netmaskToPrefix(netmask) {
    if (!netmask || netmask === '') return '';
    
    const parts = netmask.split('.').map(part => parseInt(part));
    if (parts.length !== 4 || parts.some(part => isNaN(part) || part < 0 || part > 255)) {
      return '';
    }
    
    const mask = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    return (mask >>> 0).toString(2).split('1').length - 1;
  }
}

module.exports = NetworkHelpers; 