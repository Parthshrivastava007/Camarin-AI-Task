const Job = require('../models/Job');
const { v4: uuidv4 } = require('uuid');
const { enqueueImageJob } = require('../queue/imageQueue');
const fs = require('fs');
const path = require('path');

// @desc    Upload media file and queue for processing
// @route   POST /api/jobs/upload
// @access  Private
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an image file (JPG, PNG, WEBP)' });
    }

    const jobId = uuidv4();
    
    // Save path matches static route prefix + unique upload filename
    const relativeImagePath = `uploads/${req.file.filename}`;

    // Create a new Job entry in the database
    const job = await Job.create({
      id: jobId,
      userId: req.user.id,
      status: 'pending',
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      imagePath: relativeImagePath.replace(/\\/g, '/'), // normalization
    });

    // Enqueue the job for async execution
    await enqueueImageJob(jobId);

    // Return the Job ID immediately
    return res.status(201).json({
      message: 'Image uploaded successfully. Processing started.',
      jobId: job.id,
      status: job.status,
    });
  } catch (error) {
    console.error('Upload Error:', error);
    
    // Clean up uploaded file if DB/Queue fails
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('Failed to delete file on error cleanup:', unlinkErr.message);
      }
    }
    
    return res.status(500).json({ error: 'Failed to process and enqueue upload' });
  }
};

// @desc    Get all jobs for logged-in user
// @route   GET /api/jobs
// @access  Private
const getUserJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ userId: req.user.id })
      .sort({ createdAt: -1 });

    return res.json(jobs);
  } catch (error) {
    console.error('Get User Jobs Error:', error);
    return res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};

// @desc    Get job detail by ID
// @route   GET /api/jobs/:id
// @access  Private
const getJobDetail = async (req, res) => {
  const { id } = req.params;

  try {
    const job = await Job.findOne({ id, userId: req.user.id });

    if (!job) {
      return res.status(404).json({ error: 'Job not found or access denied' });
    }

    return res.json(job);
  } catch (error) {
    console.error('Get Job Detail Error:', error);
    return res.status(500).json({ error: 'Failed to fetch job detail' });
  }
};

// @desc    Retry a failed job
// @route   POST /api/jobs/:id/retry
// @access  Private
const retryJob = async (req, res) => {
  const { id } = req.params;

  try {
    const job = await Job.findOne({ id, userId: req.user.id });

    if (!job) {
      return res.status(404).json({ error: 'Job not found or access denied' });
    }

    if (job.status !== 'failed') {
      return res.status(400).json({ error: 'Only failed jobs can be retried' });
    }

    // Reset job state in DB
    job.status = 'pending';
    job.error = null;
    job.retryCount += 1;
    await job.save();

    // Re-enqueue job
    await enqueueImageJob(job.id);

    return res.json({
      message: 'Job re-enqueued for processing',
      job,
    });
  } catch (error) {
    console.error('Retry Job Error:', error);
    return res.status(500).json({ error: 'Failed to retry job' });
  }
};

// @desc    Delete a job and its associated image file
// @route   DELETE /api/jobs/:id
// @access  Private
const deleteJob = async (req, res) => {
  const { id } = req.params;

  try {
    const job = await Job.findOne({ id, userId: req.user.id });

    if (!job) {
      return res.status(404).json({ error: 'Job not found or access denied' });
    }

    // Try to delete physical file
    const filePath = path.resolve(job.imagePath);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.error('Failed to unlink physical media file:', unlinkErr.message);
      }
    }

    // Delete from DB
    await Job.deleteOne({ id });

    return res.json({
      message: 'Job and associated media deleted successfully',
      id,
    });
  } catch (error) {
    console.error('Delete Job Error:', error);
    return res.status(500).json({ error: 'Failed to delete job' });
  }
};

module.exports = {
  uploadImage,
  getUserJobs,
  getJobDetail,
  retryJob,
  deleteJob,
};
