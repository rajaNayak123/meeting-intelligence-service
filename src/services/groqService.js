import Groq from 'groq-sdk';
import logger from '../utils/logger.js';

let groqClient = null;

const getGroqClient = () => {
  if (!groqClient) {
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }
  return groqClient;
};

const buildSystemPrompt = () => `
You are a meeting intelligence assistant. Your ONLY job is to analyze meeting transcripts and extract structured insights.

CRITICAL RULES:
1. You MUST ONLY use information explicitly stated in the transcript. DO NOT invent, assume, or hallucinate any information.
2. Every insight MUST include citations referencing the exact transcript segment(s) that support it.
3. Do NOT invent attendees, action items, decisions, or outcomes not present in the transcript.
4. Do NOT add information not explicitly stated in the transcript.
5. If the transcript is empty or too short to extract meaningful insights, return empty arrays.
6. Assignees for action items MUST be names mentioned in the transcript.
7. Due dates MUST NOT be invented — only include if explicitly mentioned in the transcript.

RESPONSE FORMAT: Return ONLY valid JSON matching this exact structure, no markdown, no extra text:
{
  "summary": [
    {
      "text": "concise summary point",
      "citations": [{"timestamp": "00:10", "speaker": "SpeakerName", "text": "exact or paraphrased quote from transcript"}]
    }
  ],
  "actionItems": [
    {
      "task": "specific task description",
      "assignee": "person's name from transcript",
      "dueDate": null,
      "citations": [{"timestamp": "00:20", "speaker": "SpeakerName", "text": "relevant transcript text"}]
    }
  ],
  "decisions": [
    {
      "text": "decision made",
      "citations": [{"timestamp": "00:30", "speaker": "SpeakerName", "text": "relevant transcript text"}]
    }
  ],
  "followUpSuggestions": [
    {
      "text": "follow-up suggestion based only on what was discussed",
      "citations": [{"timestamp": "00:40", "speaker": "SpeakerName", "text": "relevant transcript text"}]
    }
  ]
}
`;

const buildUserPrompt = (meeting) => {
  const transcriptText = meeting.transcript
    .map(entry => `[${entry.timestamp}] ${entry.speaker}: ${entry.text}`)
    .join('\n');

  return `
Analyze the following meeting transcript and extract insights. Remember to ONLY reference what is explicitly in the transcript.

Meeting Title: ${meeting.title}
Meeting Date: ${meeting.meetingDate}
Participants: ${meeting.participants.join(', ')}

TRANSCRIPT:
${transcriptText || '[No transcript provided]'}

Extract and return the JSON structure as specified. Every item must have at least one citation.
`.trim();
};

const analyzeMeeting = async (meeting, traceId = 'system') => {
  const client = getGroqClient();

  logger.info('Starting AI analysis', {
    traceId,
    meetingId: meeting._id,
    transcriptLength: meeting.transcript?.length || 0
  });

  if (!meeting.transcript || meeting.transcript.length === 0) {
    logger.warn('Empty transcript for analysis', { traceId, meetingId: meeting._id });
    return {
      summary: [],
      actionItems: [],
      decisions: [],
      followUpSuggestions: [],
      analyzedAt: new Date()
    };
  }

  const MAX_RETRIES = 2;
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(meeting) }
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' }
      });

      const rawContent = completion.choices[0]?.message?.content;
      if (!rawContent) throw new Error('Empty response from Groq');

      let parsed;
      try {
        parsed = JSON.parse(rawContent);
      } catch (parseErr) {
        throw new Error(`Invalid JSON from AI: ${parseErr.message}`);
      }
      const validated = validateAndSanitizeAnalysis(parsed, meeting);

      logger.info('AI analysis completed', {
        traceId,
        meetingId: meeting._id,
        summaryCount: validated.summary.length,
        actionItemCount: validated.actionItems.length,
        decisionCount: validated.decisions.length,
        followUpCount: validated.followUpSuggestions.length
      });

      return { ...validated, analyzedAt: new Date() };
    } catch (error) {
      lastError = error;
      logger.warn(`AI analysis attempt ${attempt} failed`, {
        traceId,
        meetingId: meeting._id,
        error: error.message
      });

      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  logger.error('AI analysis failed after all retries', {
    traceId,
    meetingId: meeting._id,
    error: lastError.message
  });

  throw new Error(`AI analysis failed: ${lastError.message}`);
};

const validateAndSanitizeAnalysis = (analysis, meeting) => {
  const validTimestamps = new Set(meeting.transcript.map(t => t.timestamp));
  const validSpeakers = new Set(meeting.transcript.map(t => t.speaker.toLowerCase()));

  const sanitizeCitations = (citations = []) => {
    if (!Array.isArray(citations)) return [];
    return citations.filter(c => {
      if (c.timestamp && !validTimestamps.has(c.timestamp)) {
        return false;
      }
      return true;
    });
  };

  const sanitizeAssignee = (assignee) => {
    if (!assignee) return null;
    if (validSpeakers.has(assignee.toLowerCase())) return assignee;
    const participantMatch = meeting.participants.find(
      p => p.toLowerCase().includes(assignee.toLowerCase()) ||
           assignee.toLowerCase().includes(p.toLowerCase().split('@')[0])
    );
    return participantMatch ? assignee : assignee; 
  };

  return {
    summary: (analysis.summary || []).map(item => ({
      text: String(item.text || '').trim(),
      citations: sanitizeCitations(item.citations)
    })).filter(item => item.text),

    actionItems: (analysis.actionItems || []).map(item => ({
      task: String(item.task || '').trim(),
      assignee: sanitizeAssignee(item.assignee) || 'Unassigned',
      dueDate: item.dueDate ? new Date(item.dueDate) : null,
      citations: sanitizeCitations(item.citations)
    })).filter(item => item.task),

    decisions: (analysis.decisions || []).map(item => ({
      text: String(item.text || '').trim(),
      citations: sanitizeCitations(item.citations)
    })).filter(item => item.text),

    followUpSuggestions: (analysis.followUpSuggestions || []).map(item => ({
      text: String(item.text || '').trim(),
      citations: sanitizeCitations(item.citations)
    })).filter(item => item.text)
  };
};

export { analyzeMeeting };
