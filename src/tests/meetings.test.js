import jwt from 'jsonwebtoken';

jest.mock('../models/Meeting.js', () => {
  const Meeting = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn()
  };
  return { Meeting, default: Meeting };
});
jest.mock('../models/ActionItem.js', () => {
  const ActionItem = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    insertMany: jest.fn(),
    countDocuments: jest.fn()
  };
  return { ActionItem, default: ActionItem };
});
jest.mock('../models/User.js', () => {
  const User = { findById: jest.fn() };
  return { User, default: User };
});
jest.mock('../services/groqService.js', () => ({
  analyzeMeeting: jest.fn().mockResolvedValue({
    summary: [{ text: 'Team plans to launch next Friday.', citations: [{ timestamp: '00:10', speaker: 'John', text: 'We should launch next Friday.' }] }],
    actionItems: [{ task: 'Prepare release notes', assignee: 'Alice', dueDate: null, citations: [{ timestamp: '00:20', speaker: 'Alice', text: 'I will prepare release notes.' }] }],
    decisions: [],
    followUpSuggestions: [],
    analyzedAt: new Date()
  })
}));
jest.mock('../config/database.js', () => jest.fn().mockResolvedValue(true));
jest.mock('../services/reminderService.js', () => ({
  startScheduler: jest.fn(),
  stopScheduler: jest.fn()
}));

import request from 'supertest';
import app from '../app.js';
import { Meeting } from '../models/Meeting.js';
import { ActionItem } from '../models/ActionItem.js';
import { User } from '../models/User.js';

process.env.JWT_SECRET = 'test_secret';
process.env.NODE_ENV = 'test';

const AUTH_TOKEN = jwt.sign({ userId: 'user123' }, 'test_secret');
const MOCK_USER = { _id: 'user123', name: 'Test User', email: 'test@example.com' };

const MOCK_MEETING = {
  _id: '000000000000000000000123',
  title: 'Sprint Planning',
  participants: ['alice@example.com', 'bob@example.com'],
  meetingDate: new Date('2026-05-20T10:00:00Z'),
  transcript: [
    { timestamp: '00:10', speaker: 'John', text: 'We should launch next Friday.' },
    { timestamp: '00:20', speaker: 'Alice', text: 'I will prepare release notes.' }
  ],
  analysis: null,
  createdBy: 'user123',
  save: jest.fn().mockResolvedValue(true)
};

beforeEach(() => {
  jest.clearAllMocks();
  User.findById = jest.fn().mockResolvedValue(MOCK_USER);
});

describe('Meeting Endpoints', () => {
  describe('POST /api/meetings', () => {
    it('should create a meeting successfully', async () => {
      Meeting.create = jest.fn().mockResolvedValue(MOCK_MEETING);

      const res = await request(app)
        .post('/api/meetings')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .send({
          title: 'Sprint Planning',
          participants: ['alice@example.com', 'bob@example.com'],
          meetingDate: '2026-05-20T10:00:00Z',
          transcript: MOCK_MEETING.transcript
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.meeting.title).toBe('Sprint Planning');
    });

    it('should return 400 for missing title', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .send({ participants: ['a@example.com'], meetingDate: '2026-05-20T10:00:00Z' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid participant email', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .send({ title: 'Test', participants: ['not-an-email'], meetingDate: '2026-05-20T10:00:00Z' });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid date', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .send({ title: 'Test', participants: ['a@example.com'], meetingDate: 'bad-date' });
      expect(res.status).toBe(400);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).post('/api/meetings').send({ title: 'Test' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/meetings/:id', () => {
    it('should get a meeting by ID', async () => {
      Meeting.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(MOCK_MEETING)
      });

      const res = await request(app)
        .get('/api/meetings/000000000000000000000123')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.data.meeting.title).toBe('Sprint Planning');
    });

    it('should return 404 for non-existent meeting', async () => {
      Meeting.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      const res = await request(app)
        .get('/api/meetings/000000000000000000000000')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid ObjectId', async () => {
      const res = await request(app)
        .get('/api/meetings/invalid-id')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/meetings', () => {
    it('should list meetings with pagination', async () => {
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([MOCK_MEETING])
      };
      Meeting.find = jest.fn().mockReturnValue(mockFind);
      Meeting.countDocuments = jest.fn().mockResolvedValue(1);

      const res = await request(app)
        .get('/api/meetings?page=1&limit=10')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(1);
    });
  });

  describe('POST /api/meetings/:id/analyze', () => {
    it('should analyze a meeting with transcript', async () => {
      const mockMeeting = { ...MOCK_MEETING };
      Meeting.findOne = jest.fn().mockResolvedValue(mockMeeting);
      ActionItem.insertMany = jest.fn().mockResolvedValue([]);

      const res = await request(app)
        .post('/api/meetings/000000000000000000000123/analyze')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.data.analysis).toBeDefined();
      expect(res.body.data.analysis.summary).toBeDefined();
      expect(res.body.data.analysis.actionItems).toBeDefined();
    });

    it('should return 404 for non-existent meeting', async () => {
      Meeting.findOne = jest.fn().mockResolvedValue(null);

      const res = await request(app)
        .post('/api/meetings/000000000000000000000000/analyze')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`);
      expect(res.status).toBe(404);
    });
  });
});
