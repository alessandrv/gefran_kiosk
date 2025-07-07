// Export all managers for easy importing
const NetworkManager = require('./NetworkManager');
const DNSManager = require('./DNSManager');
const RoutingManager = require('./RoutingManager');

module.exports = {
  NetworkManager,
  DNSManager,
  RoutingManager
}; 