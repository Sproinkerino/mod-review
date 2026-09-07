// Backend proxy that holds the OpenRouter key server-side. A pure
// client-side call would bake the key into the shipped JS bundle, visible
// to anyone via dev tools. See server/index.js for the actual model call.
const ANALYZE_URL = 'https://mod-review-server.onrender.com/analyze';

export class AnalysisUnavailableError extends Error {
  constructor(message) {
    super(message || 'The analysis backend is unavailable');
    this.name = 'AnalysisUnavailableError';
  }
}

// ============================================================================
// requestAnswer(question, subject) -- LLM analysis (live)
//
// Posts the question + timeline to the backend proxy, which forwards it to
// anthropic/claude-haiku-4.5 via OpenRouter with a system prompt that
// instructs the model to only flag against the supplied rule set, cite a
// permalink + timestamp for every flag, never speculate about the user
// beyond the text, and never recommend a moderation action.
//
// Expected response: { text: string, evidence: [{ rule, excerpt, link,
// when, severity }] }.
// ============================================================================
export async function requestAnswer(question, subject) {
  let res;
  try {
    res = await fetch(ANALYZE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, subject }),
    });
  } catch {
    throw new AnalysisUnavailableError();
  }

  if (!res.ok) {
    throw new AnalysisUnavailableError();
  }

  const data = await res.json();
  return {
    text: typeof data.text === 'string' ? data.text : 'Nothing to flag here.',
    evidence: Array.isArray(data.evidence) ? data.evidence : [],
  };
}
