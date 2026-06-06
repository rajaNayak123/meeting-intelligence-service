# Database Design

## Technology: MongoDB with Mongoose ODM

MongoDB's document model is a natural fit for meeting data. Transcripts are arrays of structured entries, and AI analysis results are nested objects with citation sub-arrays — both map cleanly to BSON documents without requiring complex joins.

---

## Collections & Schemas

### `users`

Stores registered users for authentication.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `_id` | ObjectId | PK | Auto-generated |
| `name` | String | required, 2–100 chars | Display name |
| `email` | String | required, unique, lowercase | Login email |
| `password` | String | required, bcrypt-hashed, select:false | Never returned in queries |
| `createdAt` | Date | auto | Mongoose timestamp |
| `updatedAt` | Date | auto | Mongoose timestamp |

**Indexes:** `email` (unique)

---

### `meetings`

Core entity. Stores meeting metadata, raw transcript, and the AI-generated analysis.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `_id` | ObjectId | PK | Auto-generated |
| `title` | String | required, 1–500 chars | Meeting name |
| `participants` | [String] | required, min 1 | Array of email addresses |
| `meetingDate` | Date | required | When the meeting occurred |
| `transcript` | [TranscriptEntry] | default [] | Array of timestamped speaker turns |
| `analysis` | AnalysisObject \| null | default null | Populated after `/analyze` call |
| `createdBy` | ObjectId (ref: User) | required | Owner |
| `createdAt` | Date | auto | Mongoose timestamp |
| `updatedAt` | Date | auto | Mongoose timestamp |

**Indexes:** `{ createdBy: 1, meetingDate: -1 }`, `{ title: 'text' }`

#### Embedded: `TranscriptEntry`
```
{ timestamp: String, speaker: String, text: String }
```

#### Embedded: `AnalysisObject`
```
{
  summary:            [{ text, citations: [Citation] }],
  actionItems:        [{ task, assignee, dueDate, citations: [Citation] }],
  decisions:          [{ text, citations: [Citation] }],
  followUpSuggestions:[{ text, citations: [Citation] }],
  analyzedAt:         Date
}
```

#### Embedded: `Citation`
```
{ timestamp: String, speaker: String, text: String }
```
Citations map back to a specific `transcript[].timestamp` entry, providing a verifiable audit trail for every AI-generated insight.

---

### `actionitems`

Tracks individual tasks extracted from meetings (either manually created or auto-populated from AI analysis).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `_id` | ObjectId | PK | Auto-generated |
| `meetingId` | ObjectId (ref: Meeting) | required | Parent meeting |
| `task` | String | required, 1–1000 chars | Task description |
| `assignee` | String | required | Person responsible |
| `dueDate` | Date | required | Deadline |
| `status` | String (enum) | PENDING \| IN_PROGRESS \| COMPLETED | Current status |
| `citations` | [Citation] | default [] | Source transcript segments |
| `reminderSent` | Boolean | default false | Whether a reminder was ever sent |
| `lastReminderAt` | Date \| null | default null | Timestamp of last reminder |
| `reminderHistory` | [ReminderRecord] | default [] | Full history of all reminder attempts |
| `createdBy` | ObjectId (ref: User) | optional | Creator |
| `createdAt` | Date | auto | Mongoose timestamp |
| `updatedAt` | Date | auto | Mongoose timestamp |

**Indexes:** `{ meetingId: 1 }`, `{ status: 1 }`, `{ assignee: 1 }`, `{ dueDate: 1, status: 1 }`

**Virtual:** `isOverdue` — returns `true` when `status !== COMPLETED && dueDate < now`

#### Embedded: `ReminderRecord`
```
{ sentAt: Date, channel: 'slack', success: Boolean, message: String }
```

---

## Relationships

```
User (1) ──── (many) Meeting
User (1) ──── (many) ActionItem
Meeting (1) ── (many) ActionItem   [meetingId ref]
Meeting (1) ── (1) Analysis        [embedded]
Analysis (1) ─ (many) CitedItem    [embedded array]
ActionItem (1)─ (many) ReminderRecord [embedded array]
```

---

## Design Decisions

- **Embedding vs Referencing**: Transcript and Analysis are embedded in Meeting because they are always fetched together and have a 1-to-1 lifecycle. Action items are a separate collection because they have independent lifecycle (status updates, reminder history) and need to be queried globally (e.g., overdue items across all meetings).
- **Soft citation validation**: Citations store `{ timestamp, speaker, text }` denormalized from the transcript. This avoids joins while still providing a readable audit trail. Timestamps are validated post-generation against real transcript entries.
- **reminderHistory array**: Appended to (never overwritten) so the full notification history is preserved for debugging and audit.
