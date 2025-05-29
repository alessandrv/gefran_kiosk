# GEFRAN Network Settings

A comprehensive network management application for GEFRAN devices, built with Electron, React, and Node.js.

## Features

- **Network Interface Management**: Configure static IP, DHCP, DNS settings for network interfaces
- **Routing Rules**: Add, modify, and delete network routing rules
- **DNS Configuration**: Global and interface-specific DNS settings
- **Firewall Management**: UFW firewall configuration with rule management
- **Network Diagnostics**: Ping tests, traceroute, and network statistics
- **NTP Time Synchronization**: Configure NTP servers for time sync
- **Real-time Monitoring**: Live network status and statistics

## Architecture

This application combines:
- **Frontend**: React/Next.js with Tailwind CSS and Radix UI components
- **Backend**: Express.js server with NetworkManager integration
- **Desktop App**: Electron wrapper for cross-platform desktop deployment

## Development

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Linux system with NetworkManager and UFW (for full functionality)

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development mode:
   ```bash
   # Start both frontend and Electron in development mode
   npm run electron:dev
   ```

   Or run components separately:
   ```bash
   # Terminal 1: Start frontend dev server
   npm run dev

   # Terminal 2: Start backend server
   npm run backend:dev

   # Terminal 3: Start Electron (after frontend is running)
   npm run electron
   ```

### Building for Production

1. Build the frontend:
   ```bash
   npm run export
   ```

2. Run the Electron app:
   ```bash
   npm run electron
   ```

3. Package the app for distribution:
   ```bash
   # Package for current platform
   npm run electron:pack

   # Build distributables for all platforms
   npm run electron:dist

   # Build for specific platforms
   npm run electron:dist-win    # Windows
   npm run electron:dist-mac    # macOS
   npm run electron:dist-linux  # Linux
   ```

## Deployment

### Windows
- Builds NSIS installer (.exe)
- Requires administrator privileges for network management

### macOS
- Builds DMG package
- May require code signing for distribution

### Linux
- Builds AppImage and DEB packages
- Requires root privileges for network operations

## Network Management Features

### Supported Operations

- **Interface Configuration**: Static IP, DHCP, DNS per interface
- **Routing**: Add/remove routes with gateway and metric support
- **Firewall**: UFW rule management, default policies
- **DNS**: Global DNS via systemd-resolved, interface-specific DNS
- **NTP**: Time synchronization via systemd-timesyncd
- **Diagnostics**: Ping, traceroute, network statistics

### System Requirements

- Linux with NetworkManager (nmcli)
- UFW firewall (optional, falls back to mock mode)
- systemd-resolved for DNS management
- systemd-timesyncd for NTP management
- Root/sudo privileges for network operations

## Security Considerations

- Application requests administrator privileges
- Network operations require elevated permissions
- Firewall changes affect system security
- DNS changes affect system-wide name resolution

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure the application runs with administrator privileges
2. **NetworkManager Not Found**: Install NetworkManager and nmcli tools
3. **UFW Not Available**: Install UFW or use mock mode for testing
4. **Build Failures**: Check Node.js version and clear node_modules if needed

### Logs

- Backend logs: Check console output from the backend server
- Electron logs: Use Developer Tools (Ctrl+Shift+I)
- System logs: Check journalctl for network-related errors

## Development Notes

### Mock Mode

When UFW or NetworkManager are not available, the application runs in mock mode with simulated data for testing and development.

### API Endpoints

The backend exposes REST API endpoints at `http://localhost:3001/api/`:
- `/network/interfaces` - Network interface management
- `/network/routing` - Routing table management
- `/network/dns` - DNS configuration
- `/network/firewall/*` - Firewall management
- `/network/ntp` - NTP configuration
- `/network/diagnostics/*` - Network diagnostics

## License

Copyright (c) 2025 GEFRAN. All rights reserved.

## Support

For technical support and documentation, contact the GEFRAN development team. 