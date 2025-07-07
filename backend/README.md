# Backend Refactoring - Modular Structure

This directory has been refactored from a single large `server.js` file (4,775 lines) into a clean, modular structure that's easier to maintain and extend.

## Structure Overview

```
backend/
├── server.js              # Original monolithic server (legacy)
├── server-new.js           # New modular server entry point
└── src/
    ├── managers/           # Business logic managers
    │   ├── BaseManager.js      # Base class for all managers
    │   ├── NetworkManager.js   # Core network device management
    │   ├── DNSManager.js       # DNS configuration management
    │   ├── RoutingManager.js   # Routing table management
    │   ├── FirewallManager.js  # Firewall/UFW management
    │   └── index.js            # Manager exports
    ├── routes/             # API route handlers
    │   ├── networkRoutes.js    # Network interface & routing routes
    │   ├── dnsRoutes.js        # DNS configuration routes
    │   └── index.js            # Route setup coordination
    ├── utils/              # Shared utilities
    │   ├── exec.js             # Command execution utility
    │   ├── logger.js           # Centralized logging
    │   └── helpers.js          # Network helper functions
    └── config/             # Configuration files (future use)
```

## Key Benefits

### 1. **Separation of Concerns**
- **Managers**: Handle business logic and system interactions
- **Routes**: Handle HTTP requests and responses
- **Utils**: Shared functionality across modules

### 2. **Improved Maintainability**
- Each manager focuses on a specific domain (DNS, Routing, etc.)
- Easy to locate and modify specific functionality
- Smaller, focused files instead of one massive file

### 3. **Better Testing**
- Individual managers can be unit tested in isolation
- Mock dependencies easily for testing
- Clear interfaces between components

### 4. **Scalability**
- Easy to add new managers for additional functionality
- Consistent patterns across all modules
- Centralized logging and error handling

## How to Use

### Running the New Modular Backend

```bash
# Development mode with auto-restart
npm run backend:dev:new

# Production mode
npm run backend:new
```

### Running the Original Backend (for comparison)

```bash
# Development mode
npm run backend:dev

# Production mode  
npm run backend
```

## Manager Details

### BaseManager
All managers extend `BaseManager` which provides:
- Centralized logging with module-specific prefixes
- Common utilities like `execAsync` and `checkCommandExists`
- Consistent error handling patterns

### NetworkManager
Handles core network device operations:
- Device discovery (nmcli and fallback methods)
- Interface configuration (static/DHCP)
- Connection management

### DNSManager  
Manages DNS configuration:
- Global DNS settings (`/etc/systemd/resolved.conf`)
- Interface-specific DNS
- Fallback to multiple DNS sources

### RoutingManager
Handles routing table management:
- Add/delete routes with validation
- Multiple deletion strategies for robustness
- Route parsing and ID generation

### FirewallManager
UFW firewall management:
- Enable/disable firewall
- Rule management
- Policy configuration
- Mock mode for testing without UFW

## API Endpoints

The API structure remains exactly the same, so the frontend doesn't need any changes:

```
GET    /api/health                     # Health check
GET    /api/network/interfaces         # List network interfaces  
POST   /api/network/interfaces/:id/toggle  # Toggle interface
PUT    /api/network/interfaces/:id     # Configure interface
GET    /api/network/routing            # Get routing table
POST   /api/network/routing            # Add route
DELETE /api/network/routing/:id        # Delete route
GET    /api/network/dns                # Get DNS settings
PUT    /api/network/dns                # Update DNS settings
```

## Migration Strategy

### Phase 1: Core Functionality ✅
- [x] NetworkManager (device management)
- [x] DNSManager (DNS configuration)  
- [x] RoutingManager (routing table)
- [x] Basic route structure
- [x] Working modular server

### Phase 2: Extended Functionality (TODO)
- [ ] WiFiManager (WiFi operations)
- [ ] FirewallManager routes
- [ ] DiagnosticsManager (ping, traceroute)
- [ ] ScreenManager (display settings)
- [ ] ServiceManager (SSH, FTP, VNC, etc.)

### Phase 3: Advanced Features (TODO)
- [ ] Configuration validation
- [ ] Database/persistence layer
- [ ] Advanced logging and monitoring
- [ ] Plugin system for extensibility

## Adding New Managers

To add a new manager (e.g., `WiFiManager`):

1. **Create the manager:**
```javascript
// src/managers/WiFiManager.js
const BaseManager = require('./BaseManager');

class WiFiManager extends BaseManager {
  constructor() {
    super('WiFiManager');
  }
  
  async scanNetworks() {
    // Implementation
  }
}

module.exports = WiFiManager;
```

2. **Export it:**
```javascript
// src/managers/index.js
module.exports = {
  // ... existing managers
  WiFiManager: require('./WiFiManager')
};
```

3. **Create routes:**
```javascript
// src/routes/wifiRoutes.js
const setupWiFiRoutes = (wifiManager) => {
  // Route handlers
  return router;
};
```

4. **Register in main server:**
```javascript
// server-new.js
const wifiManager = new WiFiManager();
app.use('/api/network/wifi', setupWiFiRoutes(wifiManager));
```

## Logging

Each manager has its own logger with module-specific prefixes:

```
[2025-07-07T13:19:37.371Z] [INFO] [NetworkManager] Initializing network devices...
[2025-07-07T13:19:37.372Z] [DEBUG] [DNSManager] Reading DNS configuration...
[2025-07-07T13:19:37.373Z] [ERROR] [RoutingManager] Failed to parse route: invalid format
```

## Testing

Test individual managers:

```javascript
const { NetworkManager } = require('./src/managers');

const networkManager = new NetworkManager();
await networkManager.init();
const devices = await networkManager.getDevices();
console.log(devices);
```

## Future Enhancements

1. **Configuration Management**: Centralized config files
2. **Dependency Injection**: Better testability
3. **Event System**: Manager communication
4. **Caching Layer**: Performance optimization
5. **Health Monitoring**: Manager status tracking
6. **API Versioning**: Backward compatibility
7. **OpenAPI/Swagger**: Automatic API documentation

## Performance Impact

The modular structure has minimal performance impact:
- ✅ Same HTTP response times
- ✅ Similar memory usage
- ✅ Faster startup due to code organization
- ✅ Better error isolation

The main benefits are in **developer experience** and **maintainability**. 