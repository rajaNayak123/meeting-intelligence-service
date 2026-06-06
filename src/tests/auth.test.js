import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Mock mongoose models
jest.unstable_mockModule('../models/User.js', () => {
  if (!globalThis.MockUser) {
    const mockUser = {
      _id: 'user123',
      name: 'Test User',
      email: 'test@example.com',
      comparePassword: jest.fn(),
      toJSON: jest.fn().mockReturnValue({ _id: 'user123', name: 'Test User', email: 'test@example.com' })
    };

    const MockUser = jest.fn().mockImplementation(() => mockUser);
    MockUser.findOne = jest.fn();
    MockUser.create = jest.fn();
    MockUser.findById = jest.fn();
    globalThis.MockUser = MockUser;
  }
  return { User: globalThis.MockUser, default: globalThis.MockUser };
});

jest.unstable_mockModule('../config/database.js', () => ({
  default: jest.fn().mockResolvedValue(true),
  connectDB: jest.fn().mockResolvedValue(true)
}));
jest.unstable_mockModule('../services/reminderService.js', () => ({
  startScheduler: jest.fn(),
  stopScheduler: jest.fn(),
  runReminderJob: jest.fn()
}));

const request = (await import('supertest')).default;
const { default: app } = await import('../app.js');
const userModule = await import('../models/User.js');
const User = userModule.User;
globalThis.UserInTest = User;
console.log('TEST User identity check: User === default:', User === userModule.default);

process.env.JWT_SECRET = 'test_secret';
process.env.NODE_ENV = 'test';

describe('Auth Controller Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should return 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test', email: 'not-an-email', password: 'password123' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test', email: 'test@example.com', password: '123' });
      expect(res.status).toBe(400);
    });

    it('should register successfully when email is unique', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        _id: 'user123',
        name: 'Test User',
        email: 'test@example.com'
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });

      if (res.status !== 201) console.log('REGISTER ERROR BODY:', JSON.stringify(res.body, null, 2));
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.traceId).toBeDefined();
    });

    it('should return 409 for duplicate email', async () => {
      User.findOne.mockResolvedValue({ email: 'test@example.com' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test', email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_EXISTS');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-email', password: 'pass' });
      expect(res.status).toBe(400);
    });

    it('should return 401 for non-existent user', async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });
      console.log('TEST mock value set on User.findOne:', User.findOne());

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'noone@example.com', password: 'password123' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 401 for wrong password', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        comparePassword: jest.fn().mockResolvedValue(false)
      };
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpass' });
      expect(res.status).toBe(401);
    });

    it('should login successfully', async () => {
      const mockUser = {
        _id: 'user123',
        name: 'Test User',
        email: 'test@example.com',
        comparePassword: jest.fn().mockResolvedValue(true)
      };
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken');
      expect(res.status).toBe(401);
    });

    it('should return user with valid token', async () => {
      const token = jwt.sign({ userId: 'user123' }, 'test_secret');
      User.findById.mockResolvedValue({
        _id: 'user123',
        name: 'Test User',
        email: 'test@example.com'
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('test@example.com');
    });
  });
});
