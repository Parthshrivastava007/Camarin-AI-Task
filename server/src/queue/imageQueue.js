const { Queue } = require('bullmq');
const { getRedisConnection } = require('../config/redis');

// Initialize the Redis connection for the queue
const connection = getRedisConnection();

// Listen to connection errors to prevent process crashes if Redis is offline
connection.on('error', (err) => {
  console.error('[Redis Client Error]', err.message);
});

// Create the Queue
const imageQueue = new Queue('image-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times on failure
    backoff: {
      type: 'exponential',
      delay: 5000, // Wait 5s before first retry, then 10s, 20s...
    },
    removeOnComplete: true, // Keep DB clean of completed redis jobs, we persist in Mongo
    removeOnFail: false, // Keep failed jobs in Redis for debugging/retries
  },
});

imageQueue.on('error', (err) => {
  console.error('[BullMQ Queue Error]', err.message);
});

// Helper to enqueue a job
const enqueueImageJob = async (jobId) => {
  try {
    const job = await imageQueue.add('process-image', { jobId }, { jobId });
    console.log(`Enqueued job: ${jobId} (BullMQ Job ID: ${job.id})`);
    return job;
  } catch (error) {
    console.error(`Failed to enqueue job ${jobId}:`, error.message);
    throw error;
  }
};

module.exports = {
  imageQueue,
  enqueueImageJob,
};
