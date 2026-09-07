// Backend proxy that holds the Anthropic key server-side. A pure
// client-side call would bake the key into the shipped JS bundle, visible
// to anyone via dev tools. See server/index.js for the actual model call.
const BASE_URL = 'https://mod-review-server.onrender.com';

export class AnalysisUnavailableError extends Error {
  constructor(message) {
    super(message || 'The analysis backend is unavailable');
    this.name = 'AnalysisUnavailableError';
  }
}

async function postJson(path, body) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AnalysisUnavailableError();
  }
  if (!res.ok) throw new AnalysisUnavailableError();
  return res.json();
}

// ============================================================================
// requestAnswer(question, subject) -- LLM analysis (live)
//
// Posts the question + timeline to the backend proxy, which forwards it to
// claude-haiku-4-5 with a system prompt that instructs the model to only
// flag against the supplied rule set, cite a permalink + timestamp for
// every flag, never speculate about the user beyond the text, and never
// recommend a moderation action.
//
// Expected response: { text: string, evidence: [{ rule, excerpt, link,
// when, severity }] }.
// ============================================================================
export async function requestAnswer(question, subject) {
  const data = await postJson('/analyze', { question, subject });
  return {
    text: typeof data.text === 'string' ? data.text : 'Nothing to flag here.',
    evidence: Array.isArray(data.evidence) ? data.evidence : [],
  };
}

// ============================================================================
// requestReport(subject) -- LLM analysis (live)
//
// Two of the report sections (self-described occupation, top offensive
// comments) require model judgement; the other two (top subreddits, top
// downvoted) are computed client-side in lib/timeline.js since they're
// plain aggregates with no hallucination risk.
//
// selfDescribed is deliberately narrow: the backend prompt only accepts
// verbatim first-person statements the user made about their own job or
// income, never inferred/estimated ones -- expect it to be empty for most
// accounts.
//
// Expected response: { selfDescribed: [{ excerpt, link, when }],
// topOffensive: [{ rule, excerpt, link, when, severity }] }.
// ============================================================================
export async function requestReport(subject) {
  const data = await postJson('/report', { subject });
  return {
    selfDescribed: Array.isArray(data.selfDescribed) ? data.selfDescribed : [],
    topOffensive: Array.isArray(data.topOffensive) ? data.topOffensive : [],
  };
}
