const createLogger = (moduleName) => {
  const log = (level, message, ...args) => {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${moduleName}]`;
    console.log(prefix, message, ...args);
  };

  return {
    info: (message, ...args) => log('info', message, ...args),
    warn: (message, ...args) => log('warn', message, ...args),
    error: (message, ...args) => log('error', message, ...args),
    debug: (message, ...args) => log('debug', message, ...args)
  };
};

module.exports = { createLogger }; 