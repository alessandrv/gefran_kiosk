const express = require('express');
const cors = require('cors');

// Import managers
const {
  HardwareFingerprintManager,
  NetworkManager,
  DNSManager,
  FirewallManager
} = require('./src/managers');

// Import routes
const createRoutes = require('./src/routes');

// Import utilities
const logger = require('./src/utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// Hardware fingerprinting for authorization
const AUTHORIZED_FINGERPRINT = "0849fd4c6007487b54eea41e75efa20421798b2b2fe1fadbc308489758c357c9";

// Middleware
app.use(cors());
app.use(express.json());

// Initialize managers
const hardwareManager = new HardwareFingerprintManager(AUTHORIZED_FINGERPRINT);
const networkManager = new NetworkManager();
const dnsManager = new DNSManager();
const firewallManager = new FirewallManager();

// Create routes with managers
const routes = createRoutes({
  networkManager,
  dnsManager,
  firewallManager
});

// Mount routes
app.use('/api/network', routes.network);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Hardware fingerprint endpoint (for debugging - remove in production)
app.get('/api/hardware-fingerprint', async (req, res) => {
  try {
    const currentFingerprint = await hardwareManager.getCurrentFingerprint();
    const authorizedFingerprint = hardwareManager.getAuthorizedFingerprint();
    const isAuthorized = currentFingerprint === authorizedFingerprint;
    
    res.json({
      current: currentFingerprint,
      authorized: authorizedFingerprint,
      isMatch: isAuthorized,
      status: isAuthorized ? 'authorized' : 'unauthorized'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get hardware fingerprint' });
  }
});

// Network diagnostics endpoints
app.get('/api/network/ping/:target?', async (req, res) => {
  try {
    const { target } = req.params;
    const { count } = req.query;
    
    // Note: This would need to be added to NetworkManager for diagnostics
    // For now, return a simple response
    res.json({ 
      message: 'Ping functionality would be implemented in NetworkManager',
      target: target || '8.8.8.8',
      count: count || 4
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/network/traceroute/:target?', async (req, res) => {
  try {
    const { target } = req.params;
    const { maxHops } = req.query;
    
    // Note: This would need to be added to NetworkManager for diagnostics
    // For now, return a simple response
    res.json({ 
      message: 'Traceroute functionality would be implemented in NetworkManager',
      target: target || '8.8.8.8',
      maxHops: maxHops || 15
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/network/statistics', async (req, res) => {
  try {
    // Note: This would need to be added to NetworkManager for diagnostics
    // For now, return a simple response
    res.json({ 
      message: 'Network statistics functionality would be implemented in NetworkManager'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
  try {
    logger.info('🔒 Checking hardware authorization...');
    
    // Check hardware authorization first
    const isAuthorized = await hardwareManager.verifyAuthorization();
    
    if (!isAuthorized) {
      logger.error('❌ AUTHORIZATION FAILED: This software is not authorized to run on this hardware.');
      logger.error('❌ Server startup aborted for security reasons.');
      process.exit(1);
    }
    
    logger.info('✅ Hardware authorization successful. Starting server...');
    
    // Initialize managers
    logger.info('Initializing network managers...');
    await networkManager.init();
    
    app.listen(PORT, () => {
      logger.info(`✅ Network management backend running on port ${PORT}`);
      logger.info(`📋 Health check: http://localhost:${PORT}/api/health`);
      logger.info('🔒 Hardware authorization: VERIFIED');
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 