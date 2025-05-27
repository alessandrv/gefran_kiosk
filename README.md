# Network Settings Management System

A modern web-based network management interface built with Next.js and Express, featuring D-Bus integration for real-time system network configuration.

## Features

- **Real-time Network Interface Management**: View and configure network interfaces directly from the system
- **D-Bus Integration**: Communicates with NetworkManager via D-Bus for system-level network control
- **Fallback Support**: Falls back to system commands when D-Bus is unavailable
- **Modern UI**: Clean, responsive interface built with Tailwind CSS and shadcn/ui
- **Live Updates**: Real-time status updates and health monitoring
- **Routing Management**: View and manage system routing tables
- **Security Features**: Network security settings and firewall configuration

## Architecture

### Frontend (Next.js)
- **Framework**: Next.js 15 with React 19
- **UI Components**: shadcn/ui with Tailwind CSS
- **State Management**: Custom React hooks with real-time API integration
- **TypeScript**: Full type safety throughout the application

### Backend (Express + D-Bus)
- **API Server**: Express.js REST API
- **System Integration**: D-Bus communication with NetworkManager
- **Fallback Commands**: System command execution when D-Bus unavailable
- **Real-time Updates**: Live network status monitoring

## Prerequisites

- Node.js 18+ and npm/pnpm
- Linux system with NetworkManager
- D-Bus system bus access
- sudo privileges for network configuration

## Installation

1. **Clone and install dependencies**:
```bash
git clone <repository-url>
cd network-settings
npm install
# or
pnpm install
```

2. **Install system dependencies**:
```bash
# Ubuntu/Debian
sudo apt-get install dbus libdbus-1-dev

# CentOS/RHEL
sudo yum install dbus dbus-devel

# Arch Linux
sudo pacman -S dbus
```

3. **Configure D-Bus permissions** (if needed):
```bash
# Add your user to the netdev group
sudo usermod -a -G netdev $USER

# Or create a custom D-Bus policy file
sudo tee /etc/dbus-1/system.d/network-manager-custom.conf << EOF
<!DOCTYPE busconfig PUBLIC
 "-//freedesktop//DTD D-BUS Bus Configuration 1.0//EN"
 "http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">
<busconfig>
  <policy user="$USER">
    <allow own="org.freedesktop.NetworkManager"/>
    <allow send_destination="org.freedesktop.NetworkManager"/>
    <allow send_interface="org.freedesktop.NetworkManager"/>
  </policy>
</busconfig>
EOF
```

## Usage

### Development Mode

1. **Start the backend server**:
```bash
npm run backend:dev
# or
pnpm backend:dev
```
The backend will start on `http://localhost:3001`

2. **Start the frontend** (in a new terminal):
```bash
npm run dev
# or
pnpm dev
```
The frontend will start on `http://localhost:3000`

3. **Access the application**:
- Main interface: `http://localhost:3000`
- Live network settings: `http://localhost:3000/network-live`
- API health check: `http://localhost:3001/api/health`

### Production Mode

1. **Build the frontend**:
```bash
npm run build
npm start
```

2. **Start the backend**:
```bash
npm run backend
```

## API Endpoints

### Network Interfaces
- `GET /api/network/interfaces` - Get all network interfaces
- `POST /api/network/interfaces/:id/toggle` - Toggle interface up/down
- `PUT /api/network/interfaces/:id` - Update interface configuration

### Routing
- `GET /api/network/routing` - Get routing table

### System
- `GET /api/health` - API health check

## Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
PORT=3001

# Development
NODE_ENV=development
```

### Backend Configuration

The backend automatically detects and adapts to the system environment:

- **D-Bus Available**: Uses NetworkManager D-Bus interface for full functionality
- **D-Bus Unavailable**: Falls back to system commands (`ip`, `route`, etc.)
- **Permissions**: Requires sudo access for network modifications

## Troubleshooting

### Common Issues

1. **D-Bus Connection Failed**:
   - Ensure NetworkManager is running: `sudo systemctl status NetworkManager`
   - Check D-Bus permissions: `dbus-send --system --print-reply --dest=org.freedesktop.NetworkManager /org/freedesktop/NetworkManager org.freedesktop.NetworkManager.GetDevices`

2. **Permission Denied**:
   - Add user to netdev group: `sudo usermod -a -G netdev $USER`
   - Configure sudo for network commands: `sudo visudo`

3. **API Connection Failed**:
   - Verify backend is running on port 3001
   - Check firewall settings
   - Ensure CORS is properly configured

### Logs

- **Backend logs**: Check console output from `npm run backend:dev`
- **Frontend logs**: Check browser developer console
- **System logs**: `journalctl -u NetworkManager -f`

## Development

### Project Structure

```
├── app/                    # Next.js app directory
│   └── network-live/       # Live network settings page
├── backend/                # Express backend
│   └── server.js          # Main server file
├── components/             # React components
│   ├── ui/                # shadcn/ui components
│   └── network-settings-live.tsx
├── hooks/                  # Custom React hooks
│   └── useNetworkData.ts  # Network data management
├── lib/                    # Utility libraries
│   └── api.ts             # API client
└── README.md
```

### Adding New Features

1. **Backend**: Add new routes in `backend/server.js`
2. **API Client**: Update `lib/api.ts` with new endpoints
3. **Frontend**: Create components in `components/`
4. **Hooks**: Add data management in `hooks/`

### Testing

```bash
# Test API endpoints
curl http://localhost:3001/api/health
curl http://localhost:3001/api/network/interfaces

# Test D-Bus connectivity
dbus-send --system --print-reply --dest=org.freedesktop.NetworkManager /org/freedesktop/NetworkManager org.freedesktop.NetworkManager.GetDevices
```

## Security Considerations

- **Sudo Access**: Required for network modifications
- **D-Bus Permissions**: Limit access to necessary interfaces only
- **API Security**: Consider adding authentication for production use
- **Input Validation**: All network configurations are validated
- **Error Handling**: Graceful degradation when permissions are insufficient

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Your License Here]

## Support

For issues and questions:
- Check the troubleshooting section
- Review system logs
- Open an issue on GitHub 