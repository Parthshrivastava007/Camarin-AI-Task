const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  uploadImage,
  getUserJobs,
  getJobDetail,
  retryJob,
} = require('../controllers/jobsController');

// All job routes require authentication
router.use(protect);

// Upload endpoint accepts multipart/form-data with key 'image'
router.post('/upload', upload.single('image'), uploadImage);

// Query endpoints
router.get('/', getUserJobs);
router.get('/:id', getJobDetail);

// Action endpoints
router.post('/:id/retry', retryJob);

module.exports = router;
