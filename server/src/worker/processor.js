const Job = require('../models/Job');
const { getImageCaption, getImageLabels, getImageSafeSearch } = require('../services/aiService');

const processJob = async (job) => {
  const { jobId } = job.data;
  console.log(`[Worker] Started processing job: ${jobId}`);

  // Fetch the job from MongoDB
  const dbJob = await Job.findOne({ id: jobId });
  if (!dbJob) {
    throw new Error(`Job ${jobId} not found in database`);
  }

  // Update status to processing
  dbJob.status = 'processing';
  await dbJob.save();

  try {
    const { imagePath, originalName } = dbJob;

    // Step 1: Image Captioning
    console.log(`[Worker] [Job ${jobId}] Step 1: Generating image caption...`);
    const caption = await getImageCaption(imagePath, originalName);

    // Step 2: Object/Label Detection
    console.log(`[Worker] [Job ${jobId}] Step 2: Detecting labels...`);
    const labels = await getImageLabels(imagePath, originalName);

    // Step 3: Content Safety Check
    console.log(`[Worker] [Job ${jobId}] Step 3: Checking content safety...`);
    const safeSearch = await getImageSafeSearch(imagePath, originalName);

    // Evaluate content safety
    let flagged = false;
    let flaggedCategory = null;
    const unsafeLevels = ['LIKELY', 'VERY_LIKELY'];

    for (const [category, level] of Object.entries(safeSearch)) {
      if (unsafeLevels.includes(level)) {
        flagged = true;
        flaggedCategory = category;
        break;
      }
    }

    console.log(`[Worker] [Job ${jobId}] Results generated. Flagged: ${flagged} ${flagged ? `(${flaggedCategory})` : ''}`);

    // Update job results and complete it
    dbJob.status = 'completed';
    dbJob.results = {
      caption,
      labels,
      safeSearch,
      flagged,
      flaggedCategory,
    };
    dbJob.error = null;
    await dbJob.save();

    console.log(`[Worker] Job ${jobId} completed successfully.`);
    return dbJob;
  } catch (error) {
    console.error(`[Worker] Error processing job ${jobId}:`, error.message);
    
    // Save partial error information to DB, but rethrow so BullMQ knows it failed
    dbJob.error = error.message;
    await dbJob.save();
    throw error;
  }
};

module.exports = { processJob };
