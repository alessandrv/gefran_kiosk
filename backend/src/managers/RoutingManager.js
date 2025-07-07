const BaseManager = require('./BaseManager');

class RoutingManager extends BaseManager {
  constructor() {
    super('RoutingManager');
  }

  async addRoute(destination, gateway, interfaceName, metric = 100) {
    try {
      this.logger.info(`=== Adding route: ${destination} via ${gateway} dev ${interfaceName} metric ${metric} ===`);
      
      // Validate inputs
      if (!destination || !interfaceName) {
        throw new Error('Destination and interface are required');
      }
      
      // Build the route command
      let routeCmd = `ip route add ${destination}`;
      
      if (gateway) {
        routeCmd += ` via ${gateway}`;
      }
      
      routeCmd += ` dev ${interfaceName}`;
      
      if (metric) {
        routeCmd += ` metric ${metric}`;
      }
      
      this.logger.debug(`Executing: ${routeCmd}`);
      await this.execAsync(routeCmd);
      
      return { success: true, message: `Route added successfully: ${destination} via ${gateway || 'direct'} dev ${interfaceName}` };
    } catch (error) {
      this.logger.error('Error adding route:', error);
      throw new Error(`Failed to add route: ${error.message}`);
    }
  }

  async deleteRoute(destination, gateway, interfaceName) {
    try {
      this.logger.info(`=== Deleting route: ${destination} via ${gateway} dev ${interfaceName} ===`);
      
      // Validate inputs
      if (!destination || !interfaceName) {
        throw new Error('Destination and interface are required');
      }
      
      // Try different deletion strategies based on route type
      let routeCmd;
      let success = false;
      let lastError;
      
      // Strategy 1: Try exact match with all parameters
      if (gateway) {
        routeCmd = `ip route del ${destination} via ${gateway} dev ${interfaceName}`;
        try {
          this.logger.debug(`Trying strategy 1: ${routeCmd}`);
          await this.execAsync(routeCmd);
          success = true;
        } catch (error) {
          this.logger.debug(`Strategy 1 failed: ${error.message}`);
          lastError = error;
        }
      }
      
      // Strategy 2: Try without gateway (direct route)
      if (!success) {
        routeCmd = `ip route del ${destination} dev ${interfaceName}`;
        try {
          this.logger.debug(`Trying strategy 2: ${routeCmd}`);
          await this.execAsync(routeCmd);
          success = true;
        } catch (error) {
          this.logger.debug(`Strategy 2 failed: ${error.message}`);
          lastError = error;
        }
      }
      
      // Strategy 3: Try with just destination (let kernel figure out the rest)
      if (!success) {
        routeCmd = `ip route del ${destination}`;
        try {
          this.logger.debug(`Trying strategy 3: ${routeCmd}`);
          await this.execAsync(routeCmd);
          success = true;
        } catch (error) {
          this.logger.debug(`Strategy 3 failed: ${error.message}`);
          lastError = error;
        }
      }
      
      if (!success) {
        throw new Error(`All deletion strategies failed. Last error: ${lastError?.message || 'Unknown error'}`);
      }
      
      return { success: true, message: `Route deleted successfully: ${destination}` };
    } catch (error) {
      this.logger.error('Error deleting route:', error);
      // Ensure we always return a proper error message, not HTML
      const errorMessage = error.message || 'Unknown error occurred while deleting route';
      const sanitizedError = errorMessage.replace(/<[^>]*>/g, ''); // Strip any HTML tags
      
      throw new Error(`Failed to delete route: ${sanitizedError}`);
    }
  }

  async getRoutes() {
    try {
      const { stdout } = await this.execAsync('ip route show');
      this.logger.debug('Raw route output:', stdout);
      
      const routes = stdout.split('\n')
        .filter(line => line.trim())
        .map((line, index) => {
          const parts = line.trim().split(/\s+/);
          this.logger.debug(`Parsing route line ${index + 1}: "${line.trim()}"`);
          this.logger.debug(`Parts:`, parts);
          
          // Handle different route formats
          let destination = parts[0];
          if (destination === 'default') {
            destination = '0.0.0.0/0';
          } else if (!destination.includes('/')) {
            // If no CIDR notation, assume /32 for host routes
            if (destination.match(/^\d+\.\d+\.\d+\.\d+$/)) {
              destination += '/32';
            }
          }
          
          const gatewayIndex = parts.indexOf('via');
          const devIndex = parts.indexOf('dev');
          const metricIndex = parts.indexOf('metric');
          const protoIndex = parts.indexOf('proto');
          
          // Create a unique ID based on destination, gateway, and interface
          const gateway = gatewayIndex !== -1 ? parts[gatewayIndex + 1] : '';
          const interfaceName = devIndex !== -1 ? parts[devIndex + 1] : '';
          
          // Improved ID generation - more readable and URL-safe
          let routeId = destination.replace(/\//g, '_');
          if (gateway) {
            routeId += `-via-${gateway}`;
          }
          if (interfaceName) {
            routeId += `-dev-${interfaceName}`;
          }
          // Replace any remaining special characters
          routeId = routeId.replace(/[^a-zA-Z0-9\-_\.]/g, '_');
          
          const route = {
            id: routeId,
            destination,
            gateway,
            interface: interfaceName,
            metric: metricIndex !== -1 ? parseInt(parts[metricIndex + 1]) : 0,
            protocol: protoIndex !== -1 ? parts[protoIndex + 1] : '',
            enabled: true,
            // Store original line for deletion purposes
            originalLine: line.trim()
          };
          
          this.logger.debug(`Generated route:`, route);
          return route;
        })
        .filter(route => {
          const isValid = route.destination && route.interface;
          if (!isValid) {
            this.logger.debug(`Filtering out invalid route:`, route);
          }
          return isValid;
        });

      this.logger.debug('Final parsed routes:', JSON.stringify(routes, null, 2));
      return routes;
    } catch (error) {
      this.logger.error('Error getting routes:', error);
      throw new Error('Failed to get routing table');
    }
  }
}

module.exports = RoutingManager; 