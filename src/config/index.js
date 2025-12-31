/**
 * Configuration Loader
 * Reads configuration from config.yaml and supports environment variable overrides
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

// Load config.yaml
const configPath = path.join(__dirname, '..', 'config.yaml');
let config;

try {
  const configFile = fs.readFileSync(configPath, 'utf8');
  config = yaml.parse(configFile);
} catch (error) {
  console.error('Failed to load config.yaml:', error.message);
  process.exit(1);
}

// Support environment variable overrides
const envOverrides = {
  'app.port': process.env.PORT,
  'app.host': process.env.HOST,
  'app.environment': process.env.NODE_ENV,
  'app.debug': process.env.DEBUG,
  'database.host': process.env.DB_HOST,
  'database.port': process.env.DB_PORT,
  'database.username': process.env.DB_USER,
  'database.password': process.env.DB_PASSWORD,
  'database.name': process.env.DB_NAME,
  'jwt.secret': process.env.JWT_SECRET,
  'jwt.expires_in': process.env.JWT_EXPIRES_IN,
  'email.host': process.env.SMTP_HOST,
  'email.port': process.env.SMTP_PORT,
  'email.auth.user': process.env.SMTP_USER,
  'email.auth.pass': process.env.SMTP_PASS,
  'redis.host': process.env.REDIS_HOST,
  'redis.port': process.env.REDIS_PORT,
  'redis.password': process.env.REDIS_PASSWORD,
};

// Apply environment variable overrides
function applyEnvOverrides(obj, prefix = '') {
  for (const key in obj) {
    const envKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      applyEnvOverrides(obj[key], envKey);
    } else if (envOverrides[envKey] !== undefined) {
      // Convert string to appropriate type
      const value = envOverrides[envKey];
      if (value === 'true' || value === 'false') {
        obj[key] = value === 'true';
      } else if (!isNaN(value) && value !== '') {
        obj[key] = Number(value);
      } else {
        obj[key] = value;
      }
    }
  }
}

applyEnvOverrides(config);

// Export configuration with getters for sensitive data
module.exports = {
  get app() {
    return config.app;
  },
  
  get database() {
    return config.database;
  },
  
  get jwt() {
    return config.jwt;
  },
  
  get password() {
    return config.password;
  },
  
  get email() {
    return config.email;
  },
  
  get rateLimit() {
    return config.rate_limit;
  },
  
  get cors() {
    return config.cors;
  },
  
  get logging() {
    return config.logging;
  },
  
  get upload() {
    return config.upload;
  },
  
  get pagination() {
    return config.pagination;
  },
  
  get session() {
    return config.session;
  },
  
  get redis() {
    return config.redis;
  },
  
  get documentation() {
    return config.documentation;
  },
  
  get features() {
    return config.features;
  },
  
  get development() {
    return config.development;
  },
  
  // Get nested config value
  get(path) {
    return path.split('.').reduce((obj, key) => obj && obj[key], config);
  },
  
  // Get all config (be careful with sensitive data)
  getAll() {
    return config;
  }
};
