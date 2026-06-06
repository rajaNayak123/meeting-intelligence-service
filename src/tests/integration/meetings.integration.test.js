import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app.js';

process.env.JWT_SECRET = 'integration_test_secret';
process.env.NODE_ENV   = 'test';

const registerAndLogin = async (suffix = '') => {
  const email = `meetings_test${suffix}@example.com`;
  const res = await request(app).post('/api/auth/register').send({
    name: 'Meetings User',
    email,
    password: 'password123'
  });
  return res.body.data.token;
};

const VALID_MEETING = {
  title: 'Sprint Planning',
  participants: ['alice@example.com', 'bob@example.com'],
  meetingDate: '2026-05-20T10:00:00Z',
  transcript: [
    { timestamp: '00:10', speaker: 'Alice', text: 'We should launch next Friday.' },
    { timestamp: '00:20', speaker: 'Bob',   text: 'I will prepare release notes.' }
  ]
};

describe('Meetings Integration', () => {
  describe('POST /api/meetings', () => {
    it('creates a meeting and persists it to MongoDB', async () => {
      const token = await registerAndLogin('_create');

      const res = await request(app)
        .post('/api/meetings')
        .set('Authorization', `Bearer ${token}`)
        .send(VALID_MEETING);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.meeting.title).toBe('Sprint Planning');
      expect(res.body.data.meeting._id).toBeDefined();

      // Verify it truly landed in MongoDB
      const doc = await mongoose.connection.collection('meetings')
        .findOne({ title: 'Sprint Planning' });
      expect(doc).not.toBeNull();
      expect(doc.participants).toHaveLength(2);
    });

    it('returns 400 for missing title', async () => {
      const token = await registerAndLogin('_val1');
      const res = await request(app)
        .post('/api/meetings')
        .set('Authorization', `Bearer ${token}`)
        .send({ participants: ['a@b.com'], meetingDate: '2026-05-20T10:00:00Z' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid participant email', async () => {
      const token = await registerAndLogin('_val2');
      const res = await request(app)
        .post('/api/meetings')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...VALID_MEETING, participants: ['not-an-email'] });
      expect(res.status).toBe(400);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).post('/api/meetings').send(VALID_MEETING);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/meetings', () => {
    it('lists meetings with pagination', async () => {
      const token = await registerAndLogin('_list');

      await request(app).post('/api/meetings').set('Authorization', `Bearer ${token}`).send(VALID_MEETING);
      await request(app).post('/api/meetings').set('Authorization', `Bearer ${token}`)
        .send({ ...VALID_MEETING, title: 'Retrospective' });

      const res = await request(app)
        .get('/api/meetings?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBe(2);
    });

    it('scopes results to the authenticated user only', async () => {
      const token1 = await registerAndLogin('_scope1');
      const token2 = await registerAndLogin('_scope2');

      await request(app).post('/api/meetings').set('Authorization', `Bearer ${token1}`).send(VALID_MEETING);

      const res = await request(app)
        .get('/api/meetings')
        .set('Authorization', `Bearer ${token2}`);

      expect(res.body.pagination.total).toBe(0);
    });
  });

  describe('GET /api/meetings/:id', () => {
    it('returns a meeting by ID', async () => {
      const token = await registerAndLogin('_getid');
      const createRes = await request(app)
        .post('/api/meetings').set('Authorization', `Bearer ${token}`).send(VALID_MEETING);
      const id = createRes.body.data.meeting._id;

      const res = await request(app)
        .get(`/api/meetings/${id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.meeting._id).toBe(id);
    });

    it('returns 404 for non-existent meeting', async () => {
      const token = await registerAndLogin('_404');
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/meetings/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid ObjectId', async () => {
      const token = await registerAndLogin('_badid');
      const res = await request(app)
        .get('/api/meetings/not-a-valid-id')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/meetings/:id/analyze', () => {
    it('runs AI analysis and persists results', async () => {
      const token = await registerAndLogin('_analyze');
      const createRes = await request(app)
        .post('/api/meetings').set('Authorization', `Bearer ${token}`).send(VALID_MEETING);
      const id = createRes.body.data.meeting._id;

      const res = await request(app)
        .post(`/api/meetings/${id}/analyze`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.analysis).toBeDefined();
      expect(res.body.data.analysis.summary).toBeDefined();

      const doc = await mongoose.connection.collection('meetings').findOne(
        { _id: new mongoose.Types.ObjectId(id) }
      );
      expect(doc.analysis).not.toBeNull();
    });

    it('returns 400 for meeting with no transcript', async () => {
      const token = await registerAndLogin('_notrans');
      const createRes = await request(app)
        .post('/api/meetings').set('Authorization', `Bearer ${token}`)
        .send({ title: 'Empty', participants: ['a@b.com'], meetingDate: '2026-05-20T10:00:00Z' });
      const id = createRes.body.data.meeting._id;

      const res = await request(app)
        .post(`/api/meetings/${id}/analyze`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NO_TRANSCRIPT');
    });
  });

  describe('DELETE /api/meetings/:id', () => {
    it('deletes a meeting and cascades action items', async () => {
      const token = await registerAndLogin('_del');
      const createRes = await request(app)
        .post('/api/meetings').set('Authorization', `Bearer ${token}`).send(VALID_MEETING);
      const id = createRes.body.data.meeting._id;

      const deleteRes = await request(app)
        .delete(`/api/meetings/${id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(200);

      const doc = await mongoose.connection.collection('meetings').findOne(
        { _id: new mongoose.Types.ObjectId(id) }
      );
      expect(doc).toBeNull();
    });
  });
});
