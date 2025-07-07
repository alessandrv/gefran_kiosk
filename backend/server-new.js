const express = require('express');
const cors = require('cors');

// Import managers
const { NetworkManager, DNSManager, RoutingManager } = require('./src/managers');

// Import route setup
const setupRoutes = require('./src/routes');

// Import utilities
const { createLogger } = require('./src/utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;
const logger = createLogger('Server');

// Middleware
app.use(cors());
app.use(express.json());

// Initialize managers
const networkManager = new NetworkManager();
const dnsManager = new DNSManager();
const routingManager = new RoutingManager();

const managers = {
  networkManager,
  dnsManager,
  routingManager
};

// Setup routes
setupRoutes(app, managers);

// Start server
async function startServer() {
  try {
    // Initialize all managers
    logger.info('Initializing network managers...');
    await networkManager.init();
    
    app.listen(PORT, () => {
      logger.info(`Network management backend running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 