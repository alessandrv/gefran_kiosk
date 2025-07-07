const express = require('express');
const setupNetworkRoutes = require('./networkRoutes');
const setupDNSRoutes = require('./dnsRoutes');

const setupRoutes = (app, managers) => {
  const { networkManager, dnsManager, routingManager } = managers;

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Setup route groups
  app.use('/api/network', setupNetworkRoutes(networkManager, routingManager));
  app.use('/api/network/dns', setupDNSRoutes(dnsManager));

  // Error handling middleware
  app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  });
};

module.exports = setupRoutes; 