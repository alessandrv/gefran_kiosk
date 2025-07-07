// Helper utility functions
const mapDeviceType = (nmcliType) => {
  const typeMap = {
    'ethernet': 'ethernet',
    'wifi': 'wifi',
    'wireless': 'wifi',
    '802-11-wireless': 'wifi',
    'bridge': 'bridge',
    'bond': 'bond',
    'vlan': 'vlan',
    'loopback': 'loopback'
  };
  
  const lowerType = (nmcliType || '').toLowerCase();
  if (lowerType.includes('wifi') || lowerType.includes('wireless') || lowerType.includes('802-11')) {
    return 'wifi';
  }
  
  return typeMap[nmcliType] || nmcliType || 'unknown';
};

const mapDeviceState = (nmcliState) => {
  const stateMap = {
    'connected': 'activated',
    'connecting': 'activating',
    'disconnected': 'disconnected',
    'unavailable': 'unavailable',
    'unmanaged': 'unmanaged'
  };
  return stateMap[nmcliState] || nmcliState || 'unknown';
};

const guessInterfaceType = (name) => {
  if (name.startsWith('eth') || name.startsWith('en')) return 'ethernet';
  if (name.startsWith('wl') || name.startsWith('wlan') || name.startsWith('wifi')) return 'wifi';
  if (name.startsWith('br')) return 'bridge';
  if (name.startsWith('docker') || name.startsWith('veth')) return 'virtual';
  if (name.startsWith('tun') || name.startsWith('tap')) return 'tunnel';
  return 'unknown';
};

const prefixToNetmask = (prefix) => {
  const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
  return [
    (mask >>> 24) & 0xFF,
    (mask >>> 16) & 0xFF,
    (mask >>> 8) & 0xFF,
    mask & 0xFF
  ].join('.');
};

const netmaskToPrefix = (netmask) => {
  const parts = netmask.split('.').map(Number);
  let binaryString = '';
  for (const part of parts) {
    binaryString += part.toString(2).padStart(8, '0');
  }
  return binaryString.indexOf('0') === -1 ? 32 : binaryString.indexOf('0');
};

module.exports = {
  mapDeviceType,
  mapDeviceState,
  guessInterfaceType,
  prefixToNetmask,
  netmaskToPrefix
}; 