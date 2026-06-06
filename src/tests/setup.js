import { jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Set up environment variables before any modules load
process.env.JWT_SECRET = 'test_jwt_secret_for_testing';
process.env.NODE_ENV = 'test';

// Globally mock express-rate-limit to avoid background timers keeping Jest open
jest.unstable_mockModule('express-rate-limit', () => ({
  default: () => (req, res, next) => next()
}));

// Globally mock Redis using Jest ESM mocking
jest.unstable_mockModule('../config/redis.js', () => ({
  connectRedis: jest.fn().mockResolvedValue(undefined),
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
  cacheGet: jest.fn().mockResolvedValue(null),      // always cache-miss
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
  cacheDelPattern: jest.fn().mockResolvedValue(undefined),
}));

// Globally mock Groq SDK wrapper service
jest.unstable_mockModule('../services/groqService.js', () => ({
  analyzeMeeting: jest.fn().mockResolvedValue({
    summary: [{ text: 'Summary line.', citations: [] }],
    actionItems: [{
      task: 'Follow up on budget',
      assignee: 'alice@example.com',
      dueDate: null,
      citations: []
    }],
    decisions: [],
    followUpSuggestions: [],
    analyzedAt: new Date()
  })
}));

// Globally mock Slack notifications service
jest.unstable_mockModule('../services/slackService.js', () => ({
  sendOverdueReminder: jest.fn().mockResolvedValue({ success: true }),
  sendOverdueSummary: jest.fn().mockResolvedValue({ success: true })
}));

// Globally mock Scheduler and Reminder background jobs
jest.unstable_mockModule('../services/reminderService.js', () => ({
  startScheduler: jest.fn(),
  stopScheduler: jest.fn(),
  runReminderJob: jest.fn().mockResolvedValue({ processed: 0, succeeded: 0, failed: 0 })
}));

let mongoServer;

beforeAll(async () => {
  const testPath = expect.getState().testPath;
  const isIntegration = testPath && testPath.includes('/integration/');

  if (isIntegration) {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGODB_URI = mongoUri;
    await mongoose.connect(mongoUri);
  }
});

afterAll(async () => {
  const testPath = expect.getState().testPath;
  const isIntegration = testPath && testPath.includes('/integration/');

  if (isIntegration) {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
});

afterEach(async () => {
  const testPath = expect.getState().testPath;
  const isIntegration = testPath && testPath.includes('/integration/');

  if (isIntegration) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});
