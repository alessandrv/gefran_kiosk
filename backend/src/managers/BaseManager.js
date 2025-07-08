const { execAsync } = require('../utils/exec');
const logger = require('../utils/logger');

class BaseManager {
  constructor(name) {
    this.name = name;
    this.logger = logger;
  }

  async exec(command, options = {}) {
    try {
      this.logger.debug(`[${this.name}] Executing: ${command}`);
      const result = await execAsync(command, options);
      return result;
    } catch (error) {
      this.logger.error(`[${this.name}] Command failed: ${command}`, error.message);
      throw error;
    }
  }

  log(level, message, ...args) {
    this.logger[level](`[${this.name}] ${message}`, ...args);
  }
}

module.exports = BaseManager; 