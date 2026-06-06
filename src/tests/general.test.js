jest.mock('../config/database.js', () => jest.fn().mockResolvedValue(true));
jest.mock('../services/reminderService.js', () => ({
  startScheduler: jest.fn(),
  stopScheduler: jest.fn(),
  runReminderJob: jest.fn().mockResolvedValue({ processed: 0, succeeded: 0, failed: 0 })
}));

import request from 'supertest';
import app from '../app.js';

process.env.JWT_SECRET = 'test_secret';
process.env.NODE_ENV = 'test';

describe('General Endpoints', () => {
  describe('GET /health', () => {
    it('should return UP status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/evaluation', () => {
    it('should return evaluation info', async () => {
      const res = await request(app).get('/api/evaluation');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.features).toBeDefined();
      expect(Array.isArray(res.body.data.features)).toBe(true);
    });

    it('should include externalIntegration field', async () => {
      const res = await request(app).get('/api/evaluation');
      expect(res.body.data.externalIntegration).toBeDefined();
    });
  });

  describe('Request Tracing', () => {
    it('should include traceId in API responses', async () => {
      const res = await request(app).get('/api/evaluation');
      expect(res.body.traceId).toBeDefined();
      expect(typeof res.body.traceId).toBe('string');
    });

    it('should use provided X-Trace-Id header', async () => {
      const customTraceId = 'my-custom-trace-123';
      const res = await request(app)
        .get('/api/evaluation')
        .set('X-Trace-Id', customTraceId);
      expect(res.body.traceId).toBe(customTraceId);
      expect(res.headers['x-trace-id']).toBe(customTraceId);
    });
  });

  describe('404 handling', () => {
    it('should return 404 with error format for unknown routes', async () => {
      const res = await request(app).get('/api/this-route-does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.traceId).toBeDefined();
    });
  });

  describe('Unified Response Format', () => {
    it('success responses have traceId, success=true, data', async () => {
      const res = await request(app).get('/api/evaluation');
      expect(res.body).toHaveProperty('traceId');
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
    });

    it('error responses have traceId, success=false, error', async () => {
      const res = await request(app).get('/api/this-route-does-not-exist');
      expect(res.body).toHaveProperty('traceId');
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code');
      expect(res.body.error).toHaveProperty('message');
    });
  });
});

describe('POST /api/admin/trigger-reminders', () => {
  it('should trigger reminder job and return results', async () => {
    const reminderService = await import('../services/reminderService.js');
    jest.spyOn(reminderService, 'runReminderJob').mockResolvedValueOnce({
      processed: 2,
      succeeded: 2,
      failed: 0
    });

    const res = await request(app)
      .post('/api/admin/trigger-reminders');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.processed).toBeDefined();
    expect(res.body.traceId).toBeDefined();
  });
});
