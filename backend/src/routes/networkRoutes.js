const express = require('express');
const router = express.Router();

const setupNetworkRoutes = (networkManager, routingManager) => {
  // Network interfaces endpoints
  router.get('/interfaces', async (req, res) => {
    try {
      const devices = await networkManager.getDevices();
      
      // Transform to match frontend interface
      const interfaces = devices.map(device => ({
        id: device.id,
        name: device.name,
        mac: device.mac || '',
        type: device.ipMethod === 'manual' ? 'Static' : 'DHCP',
        address: device.ip || '',
        secondaryAddress: '',
        netmask: device.netmask || '',
        gateway: device.gateway || '',
        dns1: device.dns && device.dns[0] ? device.dns[0] : '',
        dns2: device.dns && device.dns[1] ? device.dns[1] : '',
        status: device.state === 'activated' ? 'active' : 'inactive',
        enabled: device.state === 'activated'
      }));

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

  // Routing endpoints
  router.get('/routing', async (req, res) => {
    try {
      const routes = await routingManager.getRoutes();
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
      
      const result = await routingManager.addRoute(destination, gateway, targetInterface, metric);
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
      const routes = await routingManager.getRoutes();
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
      
      const result = await routingManager.deleteRoute(route.destination, route.gateway, route.interface);
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

  return router;
};

module.exports = setupNetworkRoutes; 