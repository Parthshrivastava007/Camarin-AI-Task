const app = require('./app');
const config = require('./config');
const connectDB = require('./config/db');

// Connect Database
connectDB();

// Start Server
const server = app.listen(config.port, () => {
  console.log(`[API Server] Running in ${config.nodeEnv} mode on port ${config.port}`);
});

process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

require('../src/worker/worker');

