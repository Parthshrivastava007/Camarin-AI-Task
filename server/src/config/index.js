require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/media-processor',
  jwtSecret: process.env.JWT_SECRET || 'fallback-super-secret-jwt-key-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  hfApiToken: process.env.HF_API_TOKEN || '',
  googleApiKey: process.env.GOOGLE_API_KEY || '',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  nodeEnv: process.env.NODE_ENV || 'development',
};
