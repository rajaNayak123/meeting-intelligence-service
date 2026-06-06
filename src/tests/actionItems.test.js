import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

jest.unstable_mockModule('../models/ActionItem.js', () => {
  if (!globalThis.MockActionItem) {
    const STATUS = { PENDING: 'PENDING', IN_PROGRESS: 'IN_PROGRESS', COMPLETED: 'COMPLETED' };
    globalThis.MockActionItem = {
      STATUS,
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndDelete: jest.fn(),
      findOneAndUpdate: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn()
    };
  }
  return { ActionItem: globalThis.MockActionItem, STATUS: globalThis.MockActionItem.STATUS, default: globalThis.MockActionItem };
});
jest.unstable_mockModule('../models/Meeting.js', () => {
  if (!globalThis.MockMeeting) {
    globalThis.MockMeeting = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn()
    };
  }
  return { Meeting: globalThis.MockMeeting, default: globalThis.MockMeeting };
});
jest.unstable_mockModule('../models/User.js', () => {
  if (!globalThis.MockUser) {
    globalThis.MockUser = { findById: jest.fn() };
  }
  return { User: globalThis.MockUser, default: globalThis.MockUser };
});
jest.unstable_mockModule('../config/database.js', () => {
  if (!globalThis.MockDatabase) {
    globalThis.MockDatabase = {
      default: jest.fn().mockResolvedValue(true),
      connectDB: jest.fn().mockResolvedValue(true)
    };
  }
  return globalThis.MockDatabase;
});
jest.unstable_mockModule('../services/reminderService.js', () => {
  if (!globalThis.MockReminderService) {
    globalThis.MockReminderService = {
      startScheduler: jest.fn(),
      stopScheduler: jest.fn(),
      runReminderJob: jest.fn()
    };
  }
  return globalThis.MockReminderService;
});

const request = (await import('supertest')).default;
const { default: app } = await import('../app.js');
const { ActionItem } = await import('../models/ActionItem.js');
const { Meeting } = await import('../models/Meeting.js');
const { User } = await import('../models/User.js');

process.env.JWT_SECRET = 'test_secret';
process.env.NODE_ENV = 'test';


const AUTH_TOKEN = jwt.sign({ userId: 'user123' }, 'test_secret');
const MOCK_USER = { _id: 'user123', name: 'Test User', email: 'test@example.com' };
const MOCK_MEETING = { _id: 'meeting123', title: 'Sprint Planning', createdBy: 'user123' };

const MOCK_ACTION_ITEM = {
  _id: 'item123',
  meetingId: 'meeting123',
  task: 'Prepare release notes',
  assignee: 'Alice',
  dueDate: new Date('2026-06-01T00:00:00Z'),
  status: 'PENDING',
  citations: [{ timestamp: '00:20', speaker: 'Alice', text: 'I will prepare release notes.' }],
  createdBy: 'user123'
};

beforeEach(() => {
  jest.clearAllMocks();
  User.findById = jest.fn().mockResolvedValue(MOCK_USER);
});

describe('Action Item Endpoints', () => {
  describe('POST /api/action-items', () => {
    it('should create an action item successfully', async () => {
      Meeting.findOne = jest.fn().mockResolvedValue(MOCK_MEETING);
      ActionItem.create = jest.fn().mockResolvedValue(MOCK_ACTION_ITEM);

      const res = await request(app)
        .post('/api/action-items')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .send({
          meetingId: '000000000000000000000001',
          task: 'Prepare release notes',
          assignee: 'Alice',
          dueDate: '2026-06-01T00:00:00Z'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.actionItem.task).toBe('Prepare release notes');
    });

    it('should return 400 for invalid meetingId', async () => {
      const res = await request(app)
        .post('/api/action-items')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .send({ meetingId: 'bad-id', task: 'Test', assignee: 'Alice', dueDate: '2026-06-01T00:00:00Z' });
      expect(res.status).toBe(400);
    });

    it('should return 400 for missing assignee', async () => {
      const res = await request(app)
        .post('/api/action-items')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .send({ meetingId: '000000000000000000000001', task: 'Test', dueDate: '2026-06-01T00:00:00Z' });
      expect(res.status).toBe(400);
    });

    it('should return 400 for missing task', async () => {
      const res = await request(app)
        .post('/api/action-items')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .send({ meetingId: '000000000000000000000001', assignee: 'Alice', dueDate: '2026-06-01T00:00:00Z' });
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent meeting', async () => {
      Meeting.findOne = jest.fn().mockResolvedValue(null);

      const res = await request(app)
        .post('/api/action-items')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .send({ meetingId: '000000000000000000000001', task: 'Test', assignee: 'Alice', dueDate: '2026-06-01T00:00:00Z' });
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/action-items/:id/status', () => {
    it('should update status to IN_PROGRESS', async () => {
      ActionItem.findOneAndUpdate = jest.fn().mockResolvedValue({ ...MOCK_ACTION_ITEM, status: 'IN_PROGRESS' });

      const res = await request(app)
        .patch('/api/action-items/000000000000000000000001/status')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(200);
      expect(res.body.data.actionItem.status).toBe('IN_PROGRESS');
    });

    it('should update status to COMPLETED', async () => {
      ActionItem.findOneAndUpdate = jest.fn().mockResolvedValue({ ...MOCK_ACTION_ITEM, status: 'COMPLETED' });

      const res = await request(app)
        .patch('/api/action-items/000000000000000000000001/status')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .send({ status: 'COMPLETED' });

      expect(res.status).toBe(200);
      expect(res.body.data.actionItem.status).toBe('COMPLETED');
    });

    it('should return 400 for invalid status', async () => {
      const res = await request(app)
        .patch('/api/action-items/000000000000000000000001/status')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .send({ status: 'INVALID' });
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent item', async () => {
      ActionItem.findOneAndUpdate = jest.fn().mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/action-items/000000000000000000000001/status')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .send({ status: 'COMPLETED' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/action-items', () => {
    it('should list action items with pagination', async () => {
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([MOCK_ACTION_ITEM])
      };
      ActionItem.find = jest.fn().mockReturnValue(mockFind);
      ActionItem.countDocuments = jest.fn().mockResolvedValue(1);

      const res = await request(app)
        .get('/api/action-items')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBe(1);
    });

    it('should return 400 for invalid status filter', async () => {
      const res = await request(app)
        .get('/api/action-items?status=INVALID_STATUS')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/action-items/overdue', () => {
    it('should return overdue action items', async () => {
      const overdueItem = { ...MOCK_ACTION_ITEM, dueDate: new Date('2020-01-01'), isOverdue: true };
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([overdueItem])
      };
      ActionItem.find = jest.fn().mockReturnValue(mockFind);
      ActionItem.countDocuments = jest.fn().mockResolvedValue(1);

      const res = await request(app)
        .get('/api/action-items/overdue')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBe(1);
    });
  });

  describe('DELETE /api/action-items/:id', () => {
    it('should delete an action item', async () => {
      ActionItem.findOneAndDelete = jest.fn().mockResolvedValue(MOCK_ACTION_ITEM);

      const res = await request(app)
        .delete('/api/action-items/000000000000000000000001')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent item', async () => {
      ActionItem.findOneAndDelete = jest.fn().mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/action-items/000000000000000000000001')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`);
      expect(res.status).toBe(404);
    });
  });
});
