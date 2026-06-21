const Redis = require('ioredis');

const getRedisConfig = () => {
  let host = process.env.REDIS_HOST || 'localhost';
  
  // Clean host if user supplied URL scheme prefixes (e.g., https:// or redis://)
  host = host.replace(/^(https?:\/\/|redis:\/\/)/i, '');
  
  // Strip trailing slashes or ports if included in the host string
  host = host.split('/')[0];
  if (host.includes(':')) {
    host = host.split(':')[0];
  }

  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD || undefined;

  return {
    host,
    port,
    password,
    maxRetriesPerRequest: null, // Critical requirement for BullMQ
  };
};

const getRedisConnection = () => {
  const config = getRedisConfig();
  return new Redis(config);
};

module.exports = {
  getRedisConfig,
  getRedisConnection,
};
