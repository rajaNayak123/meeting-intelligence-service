# Technical Decisions

## 1. Database: MongoDB with Mongoose

**Why chosen:**
MongoDB's document model is a natural fit for meeting data. Transcripts are arrays of structured entries, and AI analysis results are deeply nested objects with citation sub-arrays — both map directly to BSON documents without complex joins or migrations.

**Alternatives considered:**
- PostgreSQL: Strong ACID guarantees and JSON columns, but nested transcript/analysis schema is verbose. JSONB querying is less ergonomic than Mongoose.
- SQLite: Suitable for local dev but not production-grade for cloud deployment without persistent volumes.

**Trade-offs:**
- Less strict referential integrity (handled via application-level validation)
- No native joins (mitigated with Mongoose `populate`)
- Excellent performance for hierarchical/nested data (transcripts with citation arrays)

---

## 2. Authentication: JWT (JSON Web Tokens)

**Why chosen:**
JWT is stateless — no session store required, making horizontal scaling trivial. Tokens carry user identity, eliminating per-request DB lookups for authentication.

**Alternatives considered:**
- Session-based auth: Requires a session store (Redis), adds infrastructure complexity
- API Keys: Less suitable for user-facing applications
- OAuth2: Overkill for this scope; significantly more setup

**Trade-offs:**
- Tokens cannot be invalidated before expiry (acceptable for this use case)
- Token size is larger than a session cookie
- Must use HTTPS in production to prevent interception

---

## 3. LLM Provider: Groq with llama3-8b-8192

**Why chosen:**
Groq provides extremely fast inference with a generous free tier. The `llama3-8b-8192` model is capable and cost-effective for structured extraction tasks. Groq natively supports `response_format: { type: "json_object" }` which guarantees parseable JSON output without markdown wrapping.

**Alternatives considered:**
- OpenAI GPT-4: More capable but expensive and slower for high-volume use
- Gemini: Good option but more complex auth (service account) for free tier
- OpenRouter: Adds a proxy layer with slight latency overhead

**Trade-offs:**
- Smaller model may miss subtle nuances vs GPT-4 (mitigated by low temperature + structured prompts)
- Groq service availability (mitigated with 2-retry logic + exponential backoff)

---

## 4. External Integration: Slack Incoming Webhook

**Why chosen:**
Slack Incoming Webhooks are the simplest, most reliable real-time notification mechanism available. No OAuth flow required — just a single webhook URL. The Block Kit message format produces rich, readable notifications. Slack is universally used in engineering teams, making this the most practical choice for a production reminder workflow.

**Setup:** Create a Slack app → Enable Incoming Webhooks → Copy webhook URL to `SLACK_WEBHOOK_URL`

**Alternatives considered:**
- Telegram Bot API: Simple but requires users to have Telegram; less common in enterprise
- Discord Webhook: Similar simplicity but less common in professional engineering contexts
- SendGrid Email: Requires domain verification and DKIM setup for reliable delivery
- Notion API: More complex and not suited for real-time alerts

**Trade-offs:**
- Recipients need access to the Slack workspace
- Webhook sends to a single configured channel (could extend to per-user DMs with Slack API)
- Webhook URL is a secret and must be protected

---

## 5. Reminder Scheduler: node-cron

**Why chosen:**
node-cron is lightweight, zero-dependency, and runs inside the existing Node.js process — no separate worker or queue infrastructure needed. Schedule is configurable via `REMINDER_CRON_SCHEDULE` environment variable.

**Alternatives considered:**
- Bull/BullMQ: Excellent for production job queues but requires Redis
- Agenda: MongoDB-backed scheduling, adds schema complexity
- AWS Lambda scheduled events: Cloud-native but over-engineered for this scope

**Trade-offs:**
- Tied to a single process (not suitable for multi-instance deployments without a distributed lock)
- No built-in retry for failed jobs (handled via application-level try/catch and reminder history recording)

---

## 6. Project Structure

```
src/
  config/       - Database connection, Swagger spec
  controllers/  - HTTP request handlers (thin, delegate to services)
  middleware/   - Auth, trace ID, validation, error handling
  models/       - Mongoose schemas (User, Meeting, ActionItem)
  routes/       - Express routers with validation chains
  services/     - Business logic (Groq AI, Slack, Reminder scheduler)
  utils/        - Logger (Winston), response helpers
  tests/        - Unit tests with jest mocks
```

Controllers are intentionally thin — they parse requests, call services, and return responses. All business logic lives in services, making them independently testable.

---

## 7. Hallucination Prevention Strategy

**Two-layer approach:**

**Layer 1 — Prompt Engineering:**
- Temperature set to 0.1 for near-deterministic output
- System prompt explicitly prohibits inventing information not in the transcript
- Every insight must include at least one citation with a real `timestamp`
- `response_format: json_object` prevents freeform text / markdown wrapping
- Assignees must be names from the transcript; due dates must be explicitly stated

**Layer 2 — Post-Processing Validation (`validateAndSanitizeAnalysis`):**
- Extracts all real timestamps from the transcript into a Set
- Filters out any citation referencing a timestamp not present in the actual transcript
- Strips items with empty/null text fields
- Validates data types on all fields before saving to database
