# Testing Documentation

## Test Stack

| Tool | Purpose |
|------|---------|
| **Jest** | Test runner, assertions, mocking |
| **Supertest** | HTTP integration testing for Express apps |
| **jest.mock()** | Mock Mongoose models and external services — no live DB needed |

Tests use `jest.mock()` for all Mongoose models and external services (Groq, Slack, reminderService). This makes tests fast, isolated, and runnable without any infrastructure.

---

## Running Tests

```bash
npm test                 # Run all tests
npm run test:coverage    # Run with coverage report
```

---

## Test Files

| File | Covers |
|------|--------|
| `general.test.js` | Health endpoint, evaluation endpoint, trace ID, 404 handling, unified response format |
| `auth.test.js` | Register, login, `/me` endpoint, token validation, error cases |
| `meetings.test.js` | Create, get, list, analyze, validation, auth isolation |
| `actionItems.test.js` | Create, status update, list, filter, overdue, delete |

**Total: 45 tests, all passing**

---

## Test Scenarios by Feature

### General / Infrastructure
- [x] `GET /health` returns `{ status: 'UP', timestamp }`
- [x] `GET /api/evaluation` returns feature list and integration name
- [x] Every API response includes `traceId`
- [x] Custom `X-Trace-Id` header is respected and echoed back
- [x] Unknown routes return `{ success: false, error: { code: 'NOT_FOUND' } }`
- [x] Error responses always have `traceId`, `success: false`, and `error.code`

### Authentication
- [x] Register with valid data → 201 + JWT token
- [x] Register with missing `name` → 400 VALIDATION_ERROR
- [x] Register with invalid email → 400 VALIDATION_ERROR
- [x] Register with password < 6 chars → 400 VALIDATION_ERROR
- [x] Register with duplicate email → 409 EMAIL_EXISTS
- [x] Login with correct credentials → 200 + JWT token
- [x] Login with wrong password → 401 INVALID_CREDENTIALS
- [x] Login with non-existent user → 401 INVALID_CREDENTIALS
- [x] Login with invalid email format → 400 VALIDATION_ERROR
- [x] `GET /api/auth/me` without token → 401 UNAUTHORIZED
- [x] `GET /api/auth/me` with invalid token → 401 INVALID_TOKEN
- [x] `GET /api/auth/me` with valid token → 200 + user data

### Meetings
- [x] Create meeting with all fields (including transcript) → 201
- [x] Create meeting without `title` → 400 VALIDATION_ERROR
- [x] Create meeting with non-email participant → 400 VALIDATION_ERROR
- [x] Create meeting with invalid ISO date → 400 VALIDATION_ERROR
- [x] Create meeting without auth → 401
- [x] Get meeting by valid ObjectId → 200
- [x] Get meeting with non-existent ObjectId → 404
- [x] Get meeting with invalid ObjectId format → 400
- [x] List meetings with pagination → 200 + pagination metadata
- [x] Analyze meeting with transcript → 200 + analysis with citations
- [x] Analyze non-existent meeting → 404

### Action Items
- [x] Create action item for valid meeting → 201
- [x] Create action item with invalid `meetingId` format → 400
- [x] Create action item for non-existent meeting → 404
- [x] Create without `assignee` → 400
- [x] Create without `task` → 400
- [x] Update status to `IN_PROGRESS` → 200
- [x] Update status to `COMPLETED` → 200
- [x] Update with invalid status value → 400
- [x] Update non-existent item → 404
- [x] List action items → 200 with pagination
- [x] Filter by invalid `status` query param → 400
- [x] Get overdue items → 200 (only non-completed past-due items)
- [x] Delete existing item → 200
- [x] Delete non-existent item → 404

---

## Edge Cases Considered

- Empty transcript provided to analyze endpoint → returns 400 (no transcript to analyze)
- Action item with past due date → immediately appears in `/api/action-items/overdue`
- Completed items are excluded from `/api/action-items/overdue`
- Meetings created by User A are not returned for User B (auth isolation via `createdBy`)
- Invalid MongoDB ObjectId in URL → 400 (not 500) via CastError handling
- Missing request body → validation error, not server crash
- Rate limiter allows normal usage, returns 429 for abuse

---

## What's Not Tested (and Why)

| Scenario | Reason |
|----------|--------|
| Live Groq AI call | Requires real API key and network; mocked in tests |
| Live Slack webhook | Requires real webhook URL; mocked in tests |
| Cron scheduler timing | Relies on system clock; `runReminderJob()` is tested via admin endpoint |
| MongoDB memory-server integration | fastdl.mongodb.org blocked in CI; jest.mock() achieves same coverage |

These are covered by manual testing against live environment using `POST /api/admin/trigger-reminders`.
