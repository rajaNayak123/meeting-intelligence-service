# AI Approach

## Model Selection

| Setting | Value |
|---------|-------|
| **Provider** | Groq |
| **Model** | `llama3-8b-8192` |
| **Temperature** | `0.1` (near-deterministic for consistent structured extraction) |
| **Max Tokens** | `4096` |
| **Response Format** | `json_object` (enforced by Groq API — no markdown wrapping) |

---

## Prompt Design

### System Prompt

The system prompt establishes strict behavioral rules applied to every analysis:

1. **Grounding rule** — The model MUST ONLY use information explicitly present in the transcript
2. **Anti-hallucination rules** — Explicitly lists prohibited behaviors: invent attendees, action items, decisions, or outcomes not in the transcript
3. **Citation requirement** — Every insight MUST include at least one citation with `timestamp`, `speaker`, and `text` matching the transcript
4. **Empty transcript handling** — If the transcript is empty or too short, return empty arrays (not fictional content)
5. **Assignee constraint** — Action item assignees must be speaker names from the transcript
6. **Due date constraint** — Due dates only included if explicitly mentioned; otherwise `null`
7. **Temperature = 0.1** — Keeps output consistent and discourages creative embellishment

### User Prompt

Provides the model with:
- Meeting metadata (title, date, participant list)
- Full transcript formatted as `[timestamp] speaker: text`
- Explicit reminder to only reference transcript content

### JSON Schema Enforcement

The required output structure is specified in the system prompt:
```json
{
  "summary": [{ "text": "...", "citations": [{"timestamp":"...","speaker":"...","text":"..."}] }],
  "actionItems": [{ "task": "...", "assignee": "...", "dueDate": null, "citations": [...] }],
  "decisions": [{ "text": "...", "citations": [...] }],
  "followUpSuggestions": [{ "text": "...", "citations": [...] }]
}
```

---

## Citation Strategy

Each citation object references the source transcript segment that supports a given insight:

- **`timestamp`** — Maps directly to `transcript[n].timestamp` (e.g. `"00:10"`)
- **`speaker`** — The person who said the cited statement
- **`text`** — The relevant portion of their statement

Citations serve as a verifiable audit trail: any evaluator can cross-reference every AI-generated insight directly against the raw transcript.

---

## Hallucination Prevention

### Layer 1: Prompt Engineering
- Temperature `0.1` for near-deterministic output
- Explicit prohibition of invented content in the system prompt
- Required citation referencing a real timestamp for every generated item
- `response_format: json_object` prevents free-form prose and markdown fences
- Assignees must come from the transcript's speaker list
- Due dates must be explicitly stated in the transcript — never inferred

### Layer 2: Post-Processing Validation (`validateAndSanitizeAnalysis`)

After the model responds, the validation function:
1. Builds a `Set` of all timestamps present in the actual transcript
2. Filters out any citation whose `timestamp` is not in that Set (hallucinated reference)
3. Verifies assignees appear in the speaker list (case-insensitive)
4. Strips items with empty/null `text` or `task` fields
5. Converts all fields to safe types (string coercion, date parsing)
6. Returns only validated, grounded content to the caller

### Layer 3: Retry Logic
- Up to 2 retry attempts with exponential backoff (1s, 2s)
- Catches JSON parse failures and empty API responses
- All retry attempts are logged with trace ID for observability

---

## Output Validation Strategy

The `validateAndSanitizeAnalysis` function acts as a schema enforcer and grounding validator:

```
Raw AI JSON
    ↓
Parse JSON (try/catch → retry on failure)
    ↓
For each array (summary, actionItems, decisions, followUpSuggestions):
  - Filter empty text fields
  - Validate citations against real transcript timestamps
  - Coerce types (string trimming, date parsing)
    ↓
Validated, grounded analysis object → save to DB
```

---

## Auto-Creation of Action Items

After analysis, action items from the AI response are automatically inserted into the `actionitems` collection with:
- `status: PENDING`
- `dueDate`: from AI (if stated in transcript) or default +7 days
- `citations`: directly from the AI's citation array
- `createdBy`: the requesting user

This means users can immediately see their action items in `GET /api/action-items` after analysis without any extra steps.

---

## Known Limitations

1. **Context window**: Very long transcripts (>6000 tokens) may be truncated by the 8192-token model limit. Mitigation: transcript chunking (not implemented in v1).

2. **Implicit temporal references**: If a speaker says "by end of quarter," the model returns `null` for `dueDate` per the prompt instruction, which is correct behavior.

3. **Non-English names**: The model may slightly alter diacritics or transliterations in speaker names. Post-processing uses case-insensitive comparison to mitigate this.

4. **Single-speaker transcripts**: With only one speaker, all action items will be assigned to them even if the text implies someone else.

5. **Groq rate limits**: The free tier has per-minute token limits. Production deployments should implement request queuing (e.g., Bull) for high concurrency.
