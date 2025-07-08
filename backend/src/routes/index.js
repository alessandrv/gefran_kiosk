const createNetworkRoutes = require('./networkRoutes');

function createRoutes(managers) {
  const routes = {};
  
  // Create network routes with the necessary managers
  routes.network = createNetworkRoutes(
    managers.networkManager,
    managers.dnsManager,
    managers.firewallManager
  );
  
  return routes;
}

module.exports = createRoutes; 