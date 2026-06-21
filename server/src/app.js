const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const authRoutes = require('./routes/auth');
const jobRoutes = require('./routes/jobs');

const app = express();

// Middlewares
app.use(cors()); // Allow requests from all origins (frontend, etc.)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.resolve(config.uploadDir)));

// Base route for health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// App API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[App Error Handler]', err.stack || err.message);
  
  if (err instanceof require('multer').MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds the 5MB limit.' });
    }
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({ error: err.message || 'Something went wrong on the server' });
});

module.exports = app;
