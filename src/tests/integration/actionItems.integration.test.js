/**
 * Action Items integration tests — real Mongoose, real DB queries, real status transitions.
 * Redis stubbed. No model mocks.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app.js';

process.env.JWT_SECRET = 'integration_test_secret';
process.env.NODE_ENV   = 'test';

// ── Helpers ───────────────────────────────────────────────────────────────────
const registerAndLogin = async (suffix = '') => {
  const res = await request(app).post('/api/auth/register').send({
    name: 'AI Test User',
    email: `ai_test${suffix}@example.com`,
    password: 'password123'
  });
  return res.body.data.token;
};

const createMeeting = async (token) => {
  const res = await request(app)
    .post('/api/meetings')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Planning Session',
      participants: ['alice@example.com'],
      meetingDate: '2026-05-20T10:00:00Z'
    });
  return res.body.data.meeting._id;
};

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const PAST_DATE   = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // yesterday

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Action Items Integration', () => {
  describe('POST /api/action-items', () => {
    it('creates an action item linked to a real meeting', async () => {
      const token     = await registerAndLogin('_create');
      const meetingId = await createMeeting(token);

      const res = await request(app)
        .post('/api/action-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ meetingId, task: 'Write release notes', assignee: 'alice@example.com', dueDate: FUTURE_DATE });

      expect(res.status).toBe(201);
      expect(res.body.data.actionItem.task).toBe('Write release notes');
      expect(res.body.data.actionItem.status).toBe('PENDING');

      // Confirm DB write
      const doc = await mongoose.connection.collection('actionitems').findOne({ task: 'Write release notes' });
      expect(doc).not.toBeNull();
    });

    it('returns 404 when meetingId belongs to another user', async () => {
      const token1    = await registerAndLogin('_own1');
      const token2    = await registerAndLogin('_own2');
      const meetingId = await createMeeting(token1); // created by user1

      const res = await request(app)
        .post('/api/action-items')
        .set('Authorization', `Bearer ${token2}`) // accessed by user2
        .send({ meetingId, task: 'Task', assignee: 'bob@example.com', dueDate: FUTURE_DATE });

      expect(res.status).toBe(404);
    });

    it('returns 400 for missing task', async () => {
      const token     = await registerAndLogin('_val1');
      const meetingId = await createMeeting(token);
      const res = await request(app)
        .post('/api/action-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ meetingId, assignee: 'alice@example.com', dueDate: FUTURE_DATE });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid meetingId format', async () => {
      const token = await registerAndLogin('_val2');
      const res = await request(app)
        .post('/api/action-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ meetingId: 'not-an-id', task: 'Task', assignee: 'alice@example.com', dueDate: FUTURE_DATE });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/action-items/:id/status', () => {
    it('transitions status PENDING → IN_PROGRESS → COMPLETED', async () => {
      const token     = await registerAndLogin('_status');
      const meetingId = await createMeeting(token);

      const createRes = await request(app)
        .post('/api/action-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ meetingId, task: 'Status test', assignee: 'alice@example.com', dueDate: FUTURE_DATE });
      const itemId = createRes.body.data.actionItem._id;

      // PENDING → IN_PROGRESS
      let res = await request(app)
        .patch(`/api/action-items/${itemId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(200);
      expect(res.body.data.actionItem.status).toBe('IN_PROGRESS');

      // IN_PROGRESS → COMPLETED
      res = await request(app)
        .patch(`/api/action-items/${itemId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'COMPLETED' });
      expect(res.status).toBe(200);
      expect(res.body.data.actionItem.status).toBe('COMPLETED');

      // Confirm in DB
      const doc = await mongoose.connection.collection('actionitems')
        .findOne({ _id: new mongoose.Types.ObjectId(itemId) });
      expect(doc.status).toBe('COMPLETED');
    });

    it('returns 400 for invalid status value', async () => {
      const token     = await registerAndLogin('_badstatus');
      const meetingId = await createMeeting(token);
      const createRes = await request(app)
        .post('/api/action-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ meetingId, task: 'T', assignee: 'a@a.com', dueDate: FUTURE_DATE });
      const itemId = createRes.body.data.actionItem._id;

      const res = await request(app)
        .patch(`/api/action-items/${itemId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'INVALID_STATUS' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/action-items', () => {
    it('lists items with pagination and respects limit', async () => {
      const token     = await registerAndLogin('_list');
      const meetingId = await createMeeting(token);

      for (let i = 0; i < 3; i++) {
        await request(app).post('/api/action-items')
          .set('Authorization', `Bearer ${token}`)
          .send({ meetingId, task: `Task ${i}`, assignee: 'alice@example.com', dueDate: FUTURE_DATE });
      }

      const res = await request(app)
        .get('/api/action-items?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.totalPages).toBe(2);
    });

    it('filters by status', async () => {
      const token     = await registerAndLogin('_filter');
      const meetingId = await createMeeting(token);

      const createRes = await request(app).post('/api/action-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ meetingId, task: 'Filter me', assignee: 'alice@example.com', dueDate: FUTURE_DATE });
      const itemId = createRes.body.data.actionItem._id;

      await request(app).patch(`/api/action-items/${itemId}/status`)
        .set('Authorization', `Bearer ${token}`).send({ status: 'COMPLETED' });

      // Also create a PENDING item
      await request(app).post('/api/action-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ meetingId, task: 'Pending task', assignee: 'alice@example.com', dueDate: FUTURE_DATE });

      const res = await request(app)
        .get('/api/action-items?status=COMPLETED')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.pagination.total).toBe(1);
      expect(res.body.data[0].status).toBe('COMPLETED');
    });
  });

  describe('GET /api/action-items/overdue', () => {
    it('returns items where dueDate is in the past and status is not COMPLETED', async () => {
      const token     = await registerAndLogin('_overdue');
      const meetingId = await createMeeting(token);

      // Overdue item
      await request(app).post('/api/action-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ meetingId, task: 'Overdue task', assignee: 'alice@example.com', dueDate: PAST_DATE });

      // Future item (not overdue)
      await request(app).post('/api/action-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ meetingId, task: 'Future task', assignee: 'alice@example.com', dueDate: FUTURE_DATE });

      const res = await request(app)
        .get('/api/action-items/overdue')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBe(1);
      expect(res.body.data[0].task).toBe('Overdue task');
    });
  });

  describe('DELETE /api/action-items/:id', () => {
    it('deletes an action item from the database', async () => {
      const token     = await registerAndLogin('_delete');
      const meetingId = await createMeeting(token);

      const createRes = await request(app).post('/api/action-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ meetingId, task: 'To delete', assignee: 'alice@example.com', dueDate: FUTURE_DATE });
      const itemId = createRes.body.data.actionItem._id;

      const deleteRes = await request(app)
        .delete(`/api/action-items/${itemId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(200);

      // Verify DB removal
      const doc = await mongoose.connection.collection('actionitems')
        .findOne({ _id: new mongoose.Types.ObjectId(itemId) });
      expect(doc).toBeNull();
    });

    it('returns 404 when deleting another user\'s item', async () => {
      const token1    = await registerAndLogin('_del_own1');
      const token2    = await registerAndLogin('_del_own2');
      const meetingId = await createMeeting(token1);

      const createRes = await request(app).post('/api/action-items')
        .set('Authorization', `Bearer ${token1}`)
        .send({ meetingId, task: 'Private item', assignee: 'alice@example.com', dueDate: FUTURE_DATE });
      const itemId = createRes.body.data.actionItem._id;

      const res = await request(app)
        .delete(`/api/action-items/${itemId}`)
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(404);
    });
  });
});
