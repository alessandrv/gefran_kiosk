# Modular Backend Architecture

This directory contains the modularized version of the network management backend, breaking down the monolithic `server.js` file into focused, maintainable modules.

## Directory Structure

```
backend/src/
├── managers/           # Business logic managers
│   ├── BaseManager.js          # Base class for all managers
│   ├── HardwareFingerprintManager.js  # Hardware authorization
│   ├── NetworkManager.js       # Core network operations
│   ├── DNSManager.js           # DNS configuration management
│   ├── FirewallManager.js      # UFW firewall management
│   └── index.js               # Exports all managers
├── routes/            # Express route handlers
│   ├── networkRoutes.js       # Network-related API endpoints
│   └── index.js              # Route aggregator
└── utils/             # Shared utilities
    ├── exec.js               # Command execution wrapper
    ├── helpers.js            # Network utility functions
    └── logger.js             # Centralized logging
```

## Architecture Overview

### Managers

Each manager extends `BaseManager` and handles a specific domain:

- **HardwareFingerprintManager**: Hardware authorization and fingerprinting
- **NetworkManager**: Network interfaces, routing, and core networking
- **DNSManager**: DNS configuration and management
- **FirewallManager**: UFW firewall operations

### Routes

Routes are organized by functionality and use dependency injection to receive the necessary managers.

### Utilities

Shared utilities provide consistent logging, command execution, and helper functions across all modules.

## Benefits of Modular Architecture

1. **Separation of Concerns**: Each module has a single responsibility
2. **Maintainability**: Easier to modify, test, and debug individual components
3. **Reusability**: Managers can be reused in different contexts
4. **Testability**: Each module can be unit tested independently
5. **Scalability**: Easy to add new managers or routes without affecting existing code

## Usage

### Starting the Modular Server

```bash
# Development with auto-reload
npm run backend:dev:modular

# Production
npm run backend:modular
```

### Adding a New Manager

1. Create the manager in `src/managers/`
2. Extend `BaseManager`
3. Export it in `src/managers/index.js`
4. Inject it into routes as needed

Example:
```javascript
const BaseManager = require('./BaseManager');

class NewManager extends BaseManager {
  constructor() {
    super('NewManager');
  }

  async doSomething() {
    this.log('info', 'Doing something...');
    // Implementation
  }
}

module.exports = NewManager;
```

### Adding New Routes

1. Create route handlers that accept managers as parameters
2. Use dependency injection pattern
3. Add to route aggregator

Example:
```javascript
function createNewRoutes(newManager) {
  router.get('/something', async (req, res) => {
    try {
      const result = await newManager.doSomething();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  return router;
}
```

## Migration from Monolithic Structure

The original `server.js` file has been split as follows:

- **Hardware fingerprinting** → `HardwareFingerprintManager`
- **Network operations** → `NetworkManager` 
- **DNS management** → `DNSManager`
- **Firewall operations** → `FirewallManager`
- **API routes** → `routes/networkRoutes.js`
- **Utilities** → `utils/` directory

## Comparison

| Aspect | Monolithic (`server.js`) | Modular (`server-new.js`) |
|--------|-------------------------|---------------------------|
| File size | ~4,900 lines | ~130 lines main + focused modules |
| Maintainability | Low | High |
| Testability | Difficult | Easy |
| Code reuse | Limited | High |
| Debugging | Complex | Focused |
| Team collaboration | Conflicts | Independent work |

## Future Enhancements

The modular structure makes it easy to add:

- **SystemManager**: System settings, hostname, NTP
- **WiFiManager**: WiFi-specific operations  
- **ServicesManager**: SSH, FTP, X11VNC services
- **DiagnosticsManager**: Ping, traceroute, network statistics
- **ScreenManager**: Display and screensaver settings

Each can be developed independently and tested in isolation. 