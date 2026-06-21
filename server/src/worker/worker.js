const { Worker } = require('bullmq');
const connectDB = require('../config/db');
const { getRedisConfig } = require('../config/redis');
const { processJob } = require('./processor');
const Job = require('../models/Job');

// Connect to MongoDB
connectDB();

console.log('[Worker] Worker service starting up...');

// Create Worker
const worker = new Worker('image-processing', processJob, {
  connection: getRedisConfig(),
  concurrency: 2, // Process up to 2 images concurrently (helps verify async behavior under load)
});

// Event Listeners
worker.on('active', (job) => {
  console.log(`[Worker] Job ${job.id} is now active.`);
});

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} has completed successfully.`);
});

worker.on('failed', async (job, err) => {
  console.error(`[Worker] Job ${job?.id || 'unknown'} failed: ${err.message}`);
  
  if (job) {
    try {
      const { jobId } = job.data;
      const dbJob = await Job.findOne({ id: jobId });
      
      if (dbJob) {
        // Check if attempts exceeded (e.g. completed attempts >= defined max attempts)
        const maxAttempts = job.opts?.attempts || 3;
        
        if (job.attemptsMade >= maxAttempts) {
          dbJob.status = 'failed';
          dbJob.error = err.message;
          await dbJob.save();
          console.log(`[Worker] Job ${jobId} failed all ${maxAttempts} attempts. Status marked FAILED.`);
        } else {
          // Temporarily set database state to failed for immediate visibility,
          // or keep as processing/pending. Let's keep it as processing but record current error
          dbJob.error = `Attempt ${job.attemptsMade} failed: ${err.message}`;
          await dbJob.save();
          console.log(`[Worker] Job ${jobId} attempt ${job.attemptsMade} failed. Retrying in background...`);
        }
      }
    } catch (dbErr) {
      console.error('[Worker] Failed to update job status on failure:', dbErr.message);
    }
  }
});

worker.on('error', (err) => {
  console.error('[Worker] Worker global error:', err.message);
});

process.on('SIGTERM', async () => {
  console.log('[Worker] Graceful shutdown...');
  await worker.close();
  process.exit(0);
});

module.exports = worker;
