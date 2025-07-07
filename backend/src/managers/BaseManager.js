const { execAsync } = require('../utils/exec');
const { createLogger } = require('../utils/logger');

class BaseManager {
  constructor(moduleName) {
    this.logger = createLogger(moduleName);
    this.execAsync = execAsync;
  }

  async checkCommandExists(command) {
    try {
      await this.execAsync(`which ${command}`);
      return true;
    } catch {
      return false;
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BaseManager; 