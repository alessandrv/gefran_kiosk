const testOutput = `FEC:B8\\:69\\:F4\\:98\\:93\\:B1:Infra:1:2412 MHz:270 Mbit/s:40:WPA2
FEC:B8\\:69\\:F4\\:98\\:93\\:B2:Infra:153:5765 MHz:270 Mbit/s:40:WPA2
FEC:B8\\:69\\:F4\\:9A\\:4F\\:18:Infra:36:5180 MHz:270 Mbit/s:34:WPA2
FEC:B8\\:69\\:F4\\:99\\:FD\\:E4:Infra:149:5745 MHz:270 Mbit/s:19:WPA2
FEC:B8\\:69\\:F4\\:9A\\:4F\\:17:Infra:7:2442 MHz:270 Mbit/s:14:WPA2`;

console.log('Testing WiFi scan parsing...');

const networks = [];
const lines = testOutput.trim().split('\n');
const seenSSIDs = new Set();

for (const line of lines) {
  if (!line.trim()) continue;
  
  // nmcli escapes colons in MAC addresses as \: but we need to split on unescaped colons only
  // First, replace escaped colons with a placeholder, split, then restore them
  const placeholder = '||COLON||';
  const processedLine = line.replace(/\\:/g, placeholder);
  const parts = processedLine.split(':');
  const [ssid, bssid, mode, channel, frequency, rate, signal, security] = parts.map(part => 
    part.replace(new RegExp(placeholder, 'g'), ':')
  );
  
  console.log('Parsing line:', line);
  console.log('Fields:', { ssid, bssid, mode, channel, frequency, rate, signal, security });
  
  // Skip networks without SSID or duplicates
  if (!ssid || ssid.trim() === '' || seenSSIDs.has(ssid)) {
    console.log('Skipping:', ssid);
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
  }
  
  networks.push({
    ssid: ssid.trim(),
    bssid: bssid ? bssid.trim() : '',
    mode: mode || 'Unknown',
    channel: channel || '0',
    frequency: frequency || '0 MHz',
    signal: signal ? parseInt(signal) : 0,
    security: securityTypes.length > 0 ? securityTypes.join('/') : 'Open',
    isSecure: securityTypes.length > 0,
    isConnected: false
  });
}

console.log('Parsed networks:', JSON.stringify(networks, null, 2)); 