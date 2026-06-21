const { processJob } = require('../src/worker/processor');
const Job = require('../src/models/Job');
const aiService = require('../src/services/aiService');

// Mock Mongoose Job model
jest.mock('../src/models/Job');

// Mock AI Service calls
jest.mock('../src/services/aiService');

describe('Worker Job Processor Unit Tests', () => {
  let mockJobDbRecord;
  let mockQueueJob;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock BullMQ Job object
    mockQueueJob = {
      data: { jobId: 'test-job-uuid-123' },
      attemptsMade: 1,
      opts: { attempts: 3 },
    };

    // Mock DB record instance
    mockJobDbRecord = {
      id: 'test-job-uuid-123',
      userId: 'user-id-567',
      status: 'pending',
      originalName: 'test_photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      imagePath: 'uploads/image-123.jpg',
      results: {
        caption: null,
        labels: [],
        safeSearch: {},
        flagged: false,
        flaggedCategory: null,
      },
      error: null,
      save: jest.fn().mockImplementation(function() {
        return Promise.resolve(this);
      }),
    };

    // Configure Job.findOne to return our mock record
    Job.findOne.mockResolvedValue(mockJobDbRecord);
  });

  test('should process job successfully and update DB state', async () => {
    // Arrange mocks
    aiService.getImageCaption.mockResolvedValue('A beautiful modern office room');
    aiService.getImageLabels.mockResolvedValue(['Office', 'Room', 'Interior Design']);
    aiService.getImageSafeSearch.mockResolvedValue({
      adult: 'VERY_UNLIKELY',
      spoof: 'UNLIKELY',
      medical: 'VERY_UNLIKELY',
      violence: 'VERY_UNLIKELY',
      racy: 'UNLIKELY',
    });

    // Act
    const result = await processJob(mockQueueJob);

    // Assert
    expect(Job.findOne).toHaveBeenCalledWith({ id: 'test-job-uuid-123' });
    expect(aiService.getImageCaption).toHaveBeenCalledWith('uploads/image-123.jpg', 'test_photo.jpg');
    expect(aiService.getImageLabels).toHaveBeenCalledWith('uploads/image-123.jpg', 'test_photo.jpg');
    expect(aiService.getImageSafeSearch).toHaveBeenCalledWith('uploads/image-123.jpg', 'test_photo.jpg');

    expect(result.status).toBe('completed');
    expect(result.results.caption).toBe('A beautiful modern office room');
    expect(result.results.labels).toEqual(['Office', 'Room', 'Interior Design']);
    expect(result.results.flagged).toBe(false);
    expect(result.results.flaggedCategory).toBeNull();
    expect(result.error).toBeNull();
    expect(mockJobDbRecord.save).toHaveBeenCalledTimes(2); // 1st for processing, 2nd for completion
  });

  test('should flag job if content safety SafeSearch returns LIKELY or VERY_LIKELY', async () => {
    // Arrange mocks
    aiService.getImageCaption.mockResolvedValue('Unsafe photo');
    aiService.getImageLabels.mockResolvedValue(['Red', 'Liquid']);
    aiService.getImageSafeSearch.mockResolvedValue({
      adult: 'VERY_UNLIKELY',
      spoof: 'VERY_UNLIKELY',
      medical: 'VERY_UNLIKELY',
      violence: 'VERY_LIKELY', // Unsafe
      racy: 'UNLIKELY',
    });

    // Act
    const result = await processJob(mockQueueJob);

    // Assert
    expect(result.status).toBe('completed');
    expect(result.results.flagged).toBe(true);
    expect(result.results.flaggedCategory).toBe('violence');
    expect(mockJobDbRecord.save).toHaveBeenCalled();
  });

  test('should handle and rethrow error if caption generation fails, logging it in the job DB record', async () => {
    // Arrange mock to throw error
    const testError = new Error('Hugging Face API call timeout');
    aiService.getImageCaption.mockRejectedValue(testError);

    // Act & Assert
    await expect(processJob(mockQueueJob)).rejects.toThrow('Hugging Face API call timeout');
    
    // Check that partial/interim error was saved
    expect(mockJobDbRecord.error).toBe('Hugging Face API call timeout');
    expect(mockJobDbRecord.save).toHaveBeenCalled();
  });
});
