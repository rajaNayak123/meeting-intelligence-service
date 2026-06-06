import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Meeting Intelligence Service API',
      version: '1.0.0',
      description: 'AI-powered meeting intelligence service for capturing insights, action items, decisions, and follow-ups from meeting transcripts.',
      contact: {
        name: 'API Support',
        email: 'support@meetingintelligence.com'
      }
    },
    servers: [
      {
        url: process.env.BASE_URL || 'http://localhost:3000',
        description: 'API Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            traceId: { type: 'string' },
            success: { type: 'boolean', example: true },
            data: { type: 'object' }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            traceId: { type: 'string' },
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        },
        TranscriptEntry: {
          type: 'object',
          required: ['timestamp', 'speaker', 'text'],
          properties: {
            timestamp: { type: 'string', example: '00:10' },
            speaker: { type: 'string', example: 'John' },
            text: { type: 'string', example: 'We should launch next Friday.' }
          }
        },
        Meeting: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            participants: { type: 'array', items: { type: 'string' } },
            meetingDate: { type: 'string', format: 'date-time' },
            transcript: { type: 'array', items: { $ref: '#/components/schemas/TranscriptEntry' } },
            analysis: { type: 'object' },
            createdBy: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        ActionItem: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            meetingId: { type: 'string' },
            task: { type: 'string' },
            assignee: { type: 'string' },
            dueDate: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'] },
            citations: { type: 'array', items: { type: 'object' } },
            createdAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

export {swaggerSpec};
