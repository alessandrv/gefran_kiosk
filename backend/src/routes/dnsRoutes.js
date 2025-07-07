const express = require('express');
const router = express.Router();

const setupDNSRoutes = (dnsManager) => {
  // DNS Settings endpoints
  router.get('/', async (req, res) => {
    try {
      const dnsSettings = await dnsManager.getDNSSettings();
      res.json(dnsSettings);
    } catch (error) {
      console.error('Error getting DNS settings:', error);
      res.status(500).json({ error: 'Failed to get DNS settings' });
    }
  });

  router.put('/', async (req, res) => {
    try {
      const { primary, secondary, searchDomains } = req.body;
      
      const result = await dnsManager.updateGlobalDNS(primary, secondary, searchDomains);
      res.json(result);
    } catch (error) {
      console.error('Error updating DNS settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};

module.exports = setupDNSRoutes; 