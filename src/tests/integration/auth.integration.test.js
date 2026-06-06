import request from 'supertest';
import app from '../../app.js';

process.env.JWT_SECRET = 'integration_test_secret';
process.env.NODE_ENV   = 'test';

const VALID_USER = {
  name: 'Integration User',
  email: 'integration@example.com',
  password: 'securepass123'
};

describe('Auth Integration', () => {
  describe('POST /api/auth/register', () => {
    it('registers a new user and returns a JWT', async () => {
      const res = await request(app).post('/api/auth/register').send(VALID_USER);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe(VALID_USER.email);
      expect(res.body.traceId).toBeDefined();
    });

    it('returns 409 when email already registered', async () => {
      await request(app).post('/api/auth/register').send(VALID_USER);
      const res = await request(app).post('/api/auth/register').send(VALID_USER);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_EXISTS');
    });

    it('returns 400 for missing name', async () => {
      const res = await request(app).post('/api/auth/register')
        .send({ email: 'x@x.com', password: 'password123' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid email', async () => {
      const res = await request(app).post('/api/auth/register')
        .send({ name: 'Test', email: 'not-an-email', password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for password shorter than 6 chars', async () => {
      const res = await request(app).post('/api/auth/register')
        .send({ name: 'Test', email: 'x@x.com', password: '123' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(VALID_USER);
    });

    it('logs in with correct credentials', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ email: VALID_USER.email, password: VALID_USER.password });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe(VALID_USER.email);
    });

    it('returns 401 for wrong password', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ email: VALID_USER.email, password: 'wrongpassword' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns 401 for non-existent email', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ email: 'nobody@nowhere.com', password: 'password123' });
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid email format', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ email: 'bad-email', password: 'pass' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    let token;

    beforeEach(async () => {
      const res = await request(app).post('/api/auth/register').send(VALID_USER);
      token = res.body.data.token;
    });

    it('returns the authenticated user', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(VALID_USER.email);
      expect(res.body.data.user.name).toBe(VALID_USER.name);
    });

    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer tampered.token.here');
      expect(res.status).toBe(401);
    });
  });
});
