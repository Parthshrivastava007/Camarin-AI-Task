const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    imagePath: {
      type: String,
      required: true,
    },
    results: {
      caption: {
        type: String,
        default: null,
      },
      labels: {
        type: [String],
        default: [],
      },
      safeSearch: {
        type: Map,
        of: String,
        default: {},
      },
      flagged: {
        type: Boolean,
        default: false,
      },
      flaggedCategory: {
        type: String,
        default: null,
      },
    },
    error: {
      type: String,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index to quickly fetch user's jobs sorted by creation date
JobSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Job', JobSchema);
