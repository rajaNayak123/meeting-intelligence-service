# Meeting Intelligence Service

An AI-powered meeting intelligence service that helps users manage meetings, extract actionable insights from transcripts, and stay on top of follow-ups — with Slack notifications for overdue action items.

## Features

| Feature | Details |
|---------|---------|
| **JWT Authentication** | Register, login, protected routes |
| **Meeting Management** | Create/read/list with pagination & filtering |
| **AI Analysis** | Groq `llama3-8b-8192` via `POST /api/meetings/:id/analyze` |
| **Grounded Citations** | Every insight cites exact transcript segment(s) |
| **Hallucination Prevention** | Strict system prompt (temp=0.1) + post-processing validation |
| **Action Item Management** | CRUD, status tracking (PENDING → IN_PROGRESS → COMPLETED) |
| **Overdue Detection** | `GET /api/action-items/overdue` |
| **Scheduled Reminders** | node-cron hourly job with configurable schedule |
| **Slack Integration** | Rich Block Kit messages via Incoming Webhook |
| **Manual Trigger** | `POST /api/admin/trigger-reminders` to test without waiting |
| **Reminder History** | Every notification attempt logged on the ActionItem |
| **Unified Responses** | `{ traceId, success, data/error }` on every endpoint |
| **Request Tracing** | UUID trace ID in logs + `X-Trace-Id` response header |
| **Structured Logging** | Winston JSON logs |
| **Input Validation** | express-validator on all inputs |
| **Global Error Handling** | Mongoose, JWT, CastError, 500 — all handled gracefully |
| **Swagger Docs** | `GET /api/docs` (public, no auth required) |
| **Rate Limiting** | 200 req / 15 min per IP |

---

## Setup Instructions

### Prerequisites

- Node.js >= 18
- MongoDB (local instance or [MongoDB Atlas](https://www.mongodb.com/atlas) free tier)
- [Groq API key](https://console.groq.com) (free)
- Slack workspace with Incoming Webhook configured

### 1. Clone & Install

```bash
git clone <repository-url>
cd meeting-intelligence
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and fill in your values
```

### 3. Slack Webhook Setup

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Create a new app (or use an existing one)
3. Navigate to **Incoming Webhooks** → Enable → **Add New Webhook to Workspace**
4. Select your notification channel → **Allow**
5. Copy the webhook URL and paste it as `SLACK_WEBHOOK_URL` in `.env`

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | Environment |
| `MONGODB_URI` | **Yes** | — | MongoDB connection string |
| `JWT_SECRET` | **Yes** | — | Secret for signing JWTs |
| `JWT_EXPIRES_IN` | No | `7d` | JWT expiry duration |
| `GROQ_API_KEY` | **Yes** | — | Groq API key |
| `SLACK_WEBHOOK_URL` | **Yes** | — | Slack Incoming Webhook URL |
| `REMINDER_CRON_SCHEDULE` | No | `0 * * * *` | Cron schedule for reminders |
| `BASE_URL` | No | `http://localhost:3000` | Public URL (for Swagger) |

---

## Running Locally

```bash
# Development with auto-reload
npm run dev

# Production
npm start

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

---

## API Overview

### Authentication
```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"secret123"}'

# Login → get token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret123"}'
```

### Meetings
```bash
# Create meeting with transcript
curl -X POST http://localhost:3000/api/meetings \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sprint Planning",
    "participants": ["alice@example.com", "bob@example.com"],
    "meetingDate": "2026-05-20T10:00:00Z",
    "transcript": [
      {"timestamp": "00:10", "speaker": "John", "text": "We should launch next Friday."},
      {"timestamp": "00:20", "speaker": "Alice", "text": "I will prepare release notes."}
    ]
  }'

# Analyze with AI (generates summary, action items, decisions, follow-ups — all cited)
curl -X POST http://localhost:3000/api/meetings/<meetingId>/analyze \
  -H "Authorization: Bearer <token>"

# List meetings (with pagination & filtering)
curl "http://localhost:3000/api/meetings?page=1&limit=10&search=sprint" \
  -H "Authorization: Bearer <token>"
```

### Action Items
```bash
# Create action item
curl -X POST http://localhost:3000/api/action-items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"meetingId":"<id>","task":"Write release notes","assignee":"Alice","dueDate":"2026-06-15T00:00:00Z"}'

# Update status
curl -X PATCH http://localhost:3000/api/action-items/<id>/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status":"COMPLETED"}'

# Get overdue items
curl http://localhost:3000/api/action-items/overdue \
  -H "Authorization: Bearer <token>"

# Filter by status / assignee / meeting
curl "http://localhost:3000/api/action-items?status=PENDING&assignee=Alice&meetingId=<id>" \
  -H "Authorization: Bearer <token>"
```

### Slack Reminder (Manual Trigger)
```bash
# Immediately run the reminder job — sends Slack notifications for all overdue items
curl -X POST http://localhost:3000/api/admin/trigger-reminders
```

### System
```bash
# Health check
curl http://localhost:3000/health

# Evaluation endpoint
curl http://localhost:3000/api/evaluation

# API docs
open http://localhost:3000/api/docs
```

---

## Deployment

### Render
1. Connect GitHub repo → Create new **Web Service**
2. Build command: `npm install`
3. Start command: `npm start`
4. Add all environment variables in Render dashboard
5. Deploy

### Railway
```bash
railway login && railway init && railway up
railway variables set MONGODB_URI=... GROQ_API_KEY=... JWT_SECRET=... SLACK_WEBHOOK_URL=...
```

### Fly.io
```bash
fly launch
fly secrets set MONGODB_URI=... GROQ_API_KEY=... JWT_SECRET=... SLACK_WEBHOOK_URL=...
fly deploy
```

---

## Documentation

| Document | Description |
|----------|-------------|
| `README.md` | Setup, usage, deployment |
| `DATABASE.md` | Full schema documentation with field types and indexes |
| `DECISIONS.md` | Technical decisions with rationale and trade-offs |
| `AI_APPROACH.md` | Prompt design, citation strategy, hallucination prevention |
| `TESTING.md` | Test scenarios, edge cases, known limitations |
| `CHANGELOG.md` | Implementation milestones |
| `CHECKLIST.md` | Submission checklist |
| `GET /api/docs` | Live Swagger / OpenAPI documentation |
