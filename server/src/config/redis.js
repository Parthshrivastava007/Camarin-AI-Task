const Redis = require('ioredis');

const getRedisConfig = () => {
  const host = process.env.REDIS_HOST || 'localhost';
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
