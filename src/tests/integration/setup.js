import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer;

const _store = new Map();

jest.mock('../../config/redis.js', () => ({
  connectRedis: jest.fn().mockResolvedValue(undefined),
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
  cacheGet: jest.fn().mockResolvedValue(null),      // always cache-miss
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
  cacheDelPattern: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/groqService.js', () => ({
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

jest.mock('../../services/slackService.js', () => ({
  sendOverdueReminder: jest.fn().mockResolvedValue({ success: true }),
  sendOverdueSummary: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../../services/reminderService.js', () => ({
  startScheduler: jest.fn(),
  stopScheduler: jest.fn(),
  runReminderJob: jest.fn().mockResolvedValue({ processed: 0, succeeded: 0, failed: 0 })
}));

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  process.env.JWT_SECRET  = 'integration_test_secret';
  process.env.NODE_ENV    = 'test';
  await mongoose.connect(process.env.MONGODB_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
