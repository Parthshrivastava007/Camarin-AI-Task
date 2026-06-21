const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const connString = process.env.MONGO_URI || 'mongodb://localhost:27017/media-processor';
    await mongoose.connect(connString);
    console.log(`MongoDB Connected successfully.`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
