import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import rateLimit from 'express-rate-limit';

import traceMiddleware from './middleware/trace.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { swaggerSpec } from './config/swagger.js';
import logger from './utils/logger.js';

import { router as authRoutes } from './routes/auth.js';
import { router as meetingRoutes } from './routes/meetings.js';
import { router as actionItemRoutes } from './routes/actionItems.js';
import { router as adminRoutes } from './routes/admin.js';

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Trace-Id']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(traceMiddleware);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' }
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

app.get('/api/evaluation', (req, res) => {
  res.status(200).json({
    traceId: res.locals.traceId,
    success: true,
    data: {
      candidateName: 'Your Name',
      email: 'your.email@example.com',
      repositoryUrl: 'https://github.com/yourusername/meeting-intelligence',
      deployedUrl: process.env.BASE_URL || 'http://localhost:3000',
      externalIntegration: 'Slack Incoming Webhook',
      features: [
        'JWT Authentication',
        'Meeting Management (CRUD + Pagination + Filtering)',
        'AI Analysis using Groq (llama3-8b-8192)',
        'Grounded Citations — every insight cites transcript segment(s)',
        'Hallucination Prevention — prompt grounding + post-processing validation',
        'Action Item Management (CRUD + Status Tracking)',
        'Overdue Action Item Detection',
        'Scheduled Reminder Job (node-cron, hourly)',
        'Slack Incoming Webhook Integration',
        'Manual Reminder Trigger (POST /api/admin/trigger-reminders)',
        'Reminder History persisted on each ActionItem',
        'Unified API Response Format ({ traceId, success, data/error })',
        'Request Trace ID (UUID, in logs + X-Trace-Id header)',
        'Structured Logging (Winston JSON)',
        'Input Validation (express-validator)',
        'Global Error Handling (Mongoose, JWT, CastError, 500)',
        'OpenAPI / Swagger Documentation (/api/docs)',
        'Rate Limiting (200 req / 15 min)',
        'CORS Enabled',
        'Unit Tests (Jest + Supertest, 45 tests)'
      ]
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/action-items', actionItemRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Meeting Intelligence API Docs'
}));

app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.use(notFound);
app.use(errorHandler);

export default app;
