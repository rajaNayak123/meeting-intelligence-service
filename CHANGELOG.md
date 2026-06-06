# Changelog

## [1.1.0] — Updated Release

### Changed
- **External Integration**: Replaced Telegram Bot API with **Slack Incoming Webhook**
  - Uses Slack Block Kit for rich, structured notifications
  - Individual overdue reminders + bulk summary message
- **Evaluation endpoint**: Updated `externalIntegration` field and expanded feature list
- **reminderHistory.channel**: Changed from `'telegram'` to `'slack'`
- **DECISIONS.md**: Updated rationale for Slack over Telegram
- **AI_APPROACH.md**: Expanded auto-creation of action items section

### Added
- `POST /api/admin/trigger-reminders` — Manual trigger for the reminder job (for evaluation/testing)
- `DATABASE.md` — Dedicated full schema documentation with field types, indexes, and relationships
- `src/routes/admin.js` — Admin route module with Swagger annotations
- `src/services/slackService.js` — Full Slack Incoming Webhook integration

### Removed
- `src/services/telegramService.js` — Replaced by slackService.js

---

## [1.0.0] — Initial Release

### Milestone 1: Project Setup
- Initialized Node.js project with Express
- Configured MongoDB connection with Mongoose
- Set up Winston structured logging
- dotenv configuration and project folder structure

### Milestone 2: Authentication
- User model with bcrypt password hashing
- JWT token generation and verification
- Register, Login, `/api/auth/me` endpoints
- Auth middleware for route protection

### Milestone 3: Core Infrastructure
- Trace ID middleware (UUID per request, `X-Trace-Id` header)
- Unified API response format (`{ traceId, success, data/error }`)
- Global error handler (Mongoose, JWT, CastError, 404, 500)
- Input validation with express-validator
- Rate limiting (200 req/15min per IP)

### Milestone 4: Meeting Management
- Meeting model with transcript, analysis, and citation schemas
- `POST /api/meetings` — Create meeting with transcript
- `GET /api/meetings/:id` — Get meeting by ID
- `GET /api/meetings` — List with pagination and filtering (search, date range)
- `DELETE /api/meetings/:id` — Delete meeting and associated action items

### Milestone 5: AI Analysis with Groq
- Groq client with `llama3-8b-8192`
- System prompt with grounding, citation, and anti-hallucination rules
- `response_format: json_object` enforcement
- `validateAndSanitizeAnalysis()` — post-processing validation against real transcript timestamps
- Retry logic (2 attempts, exponential backoff)
- `POST /api/meetings/:id/analyze` endpoint
- Auto-creation of action items from AI analysis results

### Milestone 6: Action Item Management
- ActionItem model with status enum, dueDate, assignee, citations, reminderHistory
- `POST /api/action-items` — Create action item
- `PATCH /api/action-items/:id/status` — Update status
- `GET /api/action-items` — List with filters (status, assignee, meetingId)
- `GET /api/action-items/overdue` — Overdue detection
- `DELETE /api/action-items/:id` — Delete
- `isOverdue` virtual field on model

### Milestone 7: External Integration & Reminders
- Slack Incoming Webhook integration (Block Kit messages)
- node-cron scheduler for hourly reminder job
- Reminder job: finds overdue items → sends Slack notifications → records reminder history
- Configurable cron schedule via `REMINDER_CRON_SCHEDULE`
- Graceful scheduler start/stop on server lifecycle
- `POST /api/admin/trigger-reminders` for manual testing

### Milestone 8: API Documentation
- Swagger/OpenAPI spec via swagger-jsdoc
- Swagger UI at `GET /api/docs`
- OpenAPI JSON at `GET /api/docs.json`
- All models documented in components/schemas

### Milestone 9: Testing
- Jest + Supertest with jest.mock() for all models and services
- 4 test suites: auth, meetings, action items, general
- 45 tests covering happy paths, validation, edge cases, auth isolation

### Milestone 10: Documentation
- README.md, DECISIONS.md, AI_APPROACH.md
- TESTING.md, CHANGELOG.md, CHECKLIST.md
- DATABASE.md (schema documentation)
