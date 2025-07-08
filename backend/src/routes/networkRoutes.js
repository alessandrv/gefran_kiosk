const express = require('express');
const router = express.Router();

function createNetworkRoutes(networkManager, dnsManager, firewallManager) {
  // Network interfaces
  router.get('/interfaces', async (req, res) => {
    try {
      const devices = await networkManager.getDevices();
      console.log('Raw devices data:', JSON.stringify(devices, null, 2));
      
      // Transform to match frontend interface
      const interfaces = devices.map(device => ({
        id: device.id,
        name: device.name,
        mac: device.mac || '',
        type: device.ipMethod === 'manual' ? 'Static' : 'DHCP', // Use actual IP method
        address: device.ip || '',
        secondaryAddress: '',
        netmask: device.netmask || '',
        gateway: device.gateway || '',
        dns1: device.dns && device.dns[0] ? device.dns[0] : '',
        dns2: device.dns && device.dns[1] ? device.dns[1] : '',
        status: device.state === 'activated' ? 'active' : 'inactive',
        enabled: device.state === 'activated'
      }));

      console.log('Transformed interfaces:', JSON.stringify(interfaces, null, 2));
      res.json({ interfaces });
    } catch (error) {
      console.error('Error getting interfaces:', error);
      res.status(500).json({ error: 'Failed to get network interfaces' });
    }
  });

  router.post('/interfaces/:id/toggle', async (req, res) => {
    try {
      const { id } = req.params;
      const devices = await networkManager.getDevices();
      const device = devices.find(d => d.id === id || d.name === id);
      
      if (!device) {
        return res.status(404).json({ error: 'Interface not found' });
      }

      const result = await networkManager.toggleInterface(device.name);
      res.json(result);
    } catch (error) {
      console.error('Error toggling interface:', error);
      res.status(500).json({ error: 'Failed to toggle interface: ' + error.message });
    }
  });

  router.put('/interfaces/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { address, netmask, gateway, dns1, dns2 } = req.body;
      
      const devices = await networkManager.getDevices();
      const device = devices.find(d => d.id === id || d.name === id);
      
      if (!device) {
        return res.status(404).json({ error: 'Interface not found' });
      }

      const result = await networkManager.configureInterface(device.name, {
        address,
        netmask,
        gateway,
        dns1,
        dns2
      });
      
      res.json(result);
    } catch (error) {
      console.error('Error configuring interface:', error);
      res.status(500).json({ error: 'Failed to configure interface: ' + error.message });
    }
  });

  // Routing
  router.get('/routing', async (req, res) => {
    try {
      const routes = await networkManager.getRoutes();
      res.json({ routes });
    } catch (error) {
      console.error('Error getting routing table:', error);
      res.status(500).json({ error: 'Failed to get routing table' });
    }
  });

  router.post('/routing', async (req, res) => {
    try {
      const { destination, gateway, interface: interfaceParam, interfaceName, metric } = req.body;
      
      // Support both 'interface' and 'interfaceName' for compatibility
      const targetInterface = interfaceName || interfaceParam;
      
      // Validate required fields
      if (!destination || !targetInterface) {
        return res.status(400).json({ error: 'Destination and interface are required' });
      }
      
      const result = await networkManager.addRoute(destination, gateway, targetInterface, metric);
      res.json(result);
    } catch (error) {
      console.error('Error adding route:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/routing/:id', async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`=== DELETE route request for ID: ${id} ===`);
      
      // Get current routes to find the route to delete
      const routes = await networkManager.getRoutes();
      console.log(`Found ${routes.length} routes in routing table`);
      
      const route = routes.find(r => r.id === id);
      
      if (!route) {
        console.log(`Route with ID ${id} not found`);
        console.log('Available route IDs:', routes.map(r => r.id));
        return res.status(404).json({ error: `Route not found with ID: ${id}` });
      }
      
      console.log(`Found route to delete:`, {
        id: route.id,
        destination: route.destination,
        gateway: route.gateway,
        interface: route.interface
      });
      
      const result = await networkManager.deleteRoute(route.destination, route.gateway, route.interface);
      console.log(`Route deletion result:`, result);
      
      res.json(result);
    } catch (error) {
      console.error('Error deleting route:', error);
      
      // Ensure we always return JSON, never HTML
      const errorMessage = error.message || 'Unknown error occurred while deleting route';
      const sanitizedError = errorMessage.replace(/<[^>]*>/g, ''); // Strip any HTML tags
      
      res.status(500).json({ 
        error: `Failed to delete route: ${sanitizedError}`,
        details: error.stack ? error.stack.split('\n')[0] : 'No additional details'
      });
    }
  });

  // DNS settings
  router.get('/dns', async (req, res) => {
    try {
      const dnsSettings = await dnsManager.getDNSSettings();
      res.json(dnsSettings);
    } catch (error) {
      console.error('Error getting DNS settings:', error);
      res.status(500).json({ error: 'Failed to get DNS settings' });
    }
  });

  router.post('/dns/global', async (req, res) => {
    try {
      const { primary, secondary, searchDomains } = req.body;
      const result = await dnsManager.updateGlobalDNS(primary, secondary, searchDomains);
      res.json(result);
    } catch (error) {
      console.error('Error updating global DNS:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Firewall routes
  router.get('/firewall', async (req, res) => {
    try {
      const status = await firewallManager.getFirewallStatus();
      res.json(status);
    } catch (error) {
      console.error('Error getting firewall status:', error);
      res.status(500).json({ error: 'Failed to get firewall status' });
    }
  });

  router.post('/firewall/enable', async (req, res) => {
    try {
      const result = await firewallManager.enableFirewall();
      res.json(result);
    } catch (error) {
      console.error('Error enabling firewall:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/firewall/disable', async (req, res) => {
    try {
      const result = await firewallManager.disableFirewall();
      res.json(result);
    } catch (error) {
      console.error('Error disabling firewall:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/firewall/reset', async (req, res) => {
    try {
      const result = await firewallManager.resetFirewall();
      res.json(result);
    } catch (error) {
      console.error('Error resetting firewall:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.put('/firewall/policy', async (req, res) => {
    try {
      const { direction, policy } = req.body;
      const result = await firewallManager.setDefaultPolicy(direction, policy);
      res.json(result);
    } catch (error) {
      console.error('Error setting firewall policy:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/firewall/rules', async (req, res) => {
    try {
      const result = await firewallManager.addFirewallRule(req.body);
      res.json(result);
    } catch (error) {
      console.error('Error adding firewall rule:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/firewall/rules/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await firewallManager.deleteFirewallRule(id);
      res.json(result);
    } catch (error) {
      console.error('Error deleting firewall rule:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/firewall/logs', async (req, res) => {
    try {
      const { lines } = req.query;
      const result = await firewallManager.getFirewallLogs(lines ? parseInt(lines) : 50);
      res.json(result);
    } catch (error) {
      console.error('Error getting firewall logs:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createNetworkRoutes; 