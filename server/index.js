import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-haiku-4-5-20251001';

// Cap how much timeline we send per request. Full context-aware chunking
// (map-reduce over multiple chunks for very large histories) is not
// implemented in this pass -- for now we just take the most recent items
// up to a character budget. claude-haiku-4-5 has a 200K token context
// window (~4 chars/token), so this budget leaves generous headroom for
// the system prompt and output while covering large accounts. Previously
// this was 40K chars, which silently truncated to a small fraction of a
// very active user's history.
const MAX_ITEMS = 3000;
const MAX_CHARS = 500000;

const DEFAULT_RULES = [
  'Harassment or personal attacks directed at another user',
  'Hate speech or slurs targeting a protected group',
  'Threats of violence or wishing harm on someone',
  'Spam or repeated self-promotion (e.g. the same product/course/link posted across unrelated threads)',
  'Doxxing or sharing another person\'s private information',
  'Ban evasion or explicit references to evading moderation',
];

const SYSTEM_PROMPT = `You are an assistant helping a subreddit moderator review a user's public post/comment history. You are shown a chronological timeline of that user's own posts and comments, and a moderator's question about it.

Rules you must follow:
- Only flag content against this rule set: ${DEFAULT_RULES.map((r) => `"${r}"`).join(', ')}. Do not invent additional rules.
- Every flag MUST cite the exact permalink and timestamp of the item it comes from. Never assert a violation without a citable item.
- Do not diagnose, psychoanalyse, or speculate about the user's identity, location, politics, or mental state beyond what the text explicitly says.
- Do not recommend a moderation action (no "ban this user", "this warrants a suspension", etc). You gather and cite evidence only -- the moderator decides.
- If nothing in the timeline matches the question or the rule set, say so plainly and return an empty evidence array. Do not manufacture a flag to seem useful.

Respond with ONLY a JSON object, no markdown fencing, in exactly this shape:
{"text": "<1-3 sentence answer to the moderator's question>", "evidence": [{"rule": "<which rule this violates>", "excerpt": "<verbatim excerpt from the item>", "link": "<permalink>", "when": "<human-readable date>", "severity": "high" | "medium" | "low"}]}`;

const REPORT_SYSTEM_PROMPT = `You are an assistant helping a subreddit moderator review a user's public post/comment history. You are shown a chronological timeline of that user's own posts and comments. Produce two lists for a moderation report.

1. selfDescribed -- statements where the user explicitly describes their OWN occupation or income, in first person, in their own words (e.g. "I work as a nurse", "I made $80k last year"). This must be a direct self-statement about themselves.
   - Do NOT infer occupation or income from subreddit membership, jargon, writing style, or any indirect signal.
   - Do NOT guess or estimate a number or job title that isn't explicitly stated by the user about themselves.
   - If you are not certain an excerpt is an explicit first-person self-statement of the user's own job or income, leave it out.
   - It is normal and expected for this list to be empty most of the time. An empty list is the correct, honest answer when nothing qualifies -- do not stretch to fill it.

2. topOffensive -- up to 5 items that most clearly violate this rule set: ${DEFAULT_RULES.map((r) => `"${r}"`).join(', ')}. Rank most severe first. Do not invent additional rules. If nothing violates the rule set, return an empty list -- do not manufacture a flag to seem useful.

Every item in both lists MUST cite the exact permalink and timestamp it came from, and the excerpt must be verbatim from the timeline, not paraphrased.

Do not diagnose, psychoanalyse, or speculate about the user's identity, location, politics, or mental state beyond what the text explicitly says. Do not recommend a moderation action.

Respond with ONLY a JSON object, no markdown fencing, in exactly this shape:
{"selfDescribed": [{"excerpt": "<verbatim>", "link": "<permalink>", "when": "<human-readable date>"}], "topOffensive": [{"rule": "<which rule>", "excerpt": "<verbatim>", "link": "<permalink>", "when": "<human-readable date>", "severity": "high" | "medium" | "low"}]}`;

const SELECT_SYSTEM_PROMPT = `You are a selection step in a two-stage review pipeline. A second, more careful step will read the FULL TEXT of only the items you select -- your job is just to point it at the right ones, from a compact index (id|type|subreddit|date|score|snippet) of a Reddit user's post/comment history.

You are given a focus describing what the second step needs to look at. Return the ids of every item that is plausibly relevant to that focus.

- Prioritize recall over precision. If an item might be relevant, include it -- the second step will read the full text and can discard it if it turns out not to matter. Do not under-select.
- If the focus is broad (e.g. general rule violations, or "summarise activity"), return a representative spread across subreddits and time rather than just the newest few.
- If the focus is narrow (e.g. a specific topic), only include items that plausibly relate to it.
- Return at most {{MAX_SELECTED}} ids, ranked most relevant first.

Respond with ONLY a JSON object, no markdown fencing, in exactly this shape:
{"ids": ["<id>", "<id>", ...]}`;

// Compact per-item line for the selector pass: id|type|subreddit|date|score|snippet.
// Deliberately much smaller than the full item text so the selector can see
// the entire fetched set (even at DEFAULT_COMMENT_CAP=500) in one call.
function buildCompactIndex(items) {
  return items
    .map((item) => {
      const when = new Date(item.created_utc * 1000).toISOString().slice(0, 10);
      const snippet = `${item.title ? item.title + ' -- ' : ''}${item.body || ''}`
        .replace(/\s+/g, ' ')
        .slice(0, 160);
      return `${item.id}|${item.type}|r/${item.subreddit}|${when}|score:${item.score}|${snippet}`;
    })
    .join('\n');
}

// Sub-agent: picks which items are worth sending full-text to the real
// analysis call, instead of blindly truncating by recency/char count. Runs
// over a compact index so it can see the whole fetched set even when that's
// hundreds of items. Falls back to recency-based selection (the old
// behaviour) if the selector call fails or the history is small enough
// that filtering isn't worth the extra round trip.
async function selectRelevantItems(items, focus, maxSelected) {
  if (items.length <= maxSelected) return items;

  try {
    const prompt = SELECT_SYSTEM_PROMPT.replace('{{MAX_SELECTED}}', String(maxSelected));
    const userPrompt = `Focus: "${focus}"\n\nCompact index (${items.length} items):\n\n${buildCompactIndex(items)}`;
    const parsed = await callModel(prompt, userPrompt);
    const ids = new Set(Array.isArray(parsed?.ids) ? parsed.ids : []);
    if (!ids.size) throw new Error('empty_selection');
    const selected = items.filter((i) => ids.has(i.id));
    if (selected.length) return selected;
    throw new Error('no_matches');
  } catch (err) {
    console.error('selectRelevantItems fallback to recency:', err.message);
    return [...items].sort((a, b) => b.created_utc - a.created_utc).slice(0, maxSelected);
  }
}

function buildTimelineText(items) {
  let text = '';
  let count = 0;
  // Most recent first so truncation (if any) drops the oldest items.
  const sorted = [...items].sort((a, b) => b.created_utc - a.created_utc).slice(0, MAX_ITEMS);
  for (const item of sorted) {
    const when = new Date(item.created_utc * 1000).toISOString().slice(0, 10);
    const line = `[${item.type} in r/${item.subreddit} on ${when}] ${item.title ? `"${item.title}" -- ` : ''}${item.body}\nlink: ${item.permalink}\n\n`;
    if (text.length + line.length > MAX_CHARS) break;
    text += line;
    count++;
  }
  return { text, count };
}

async function callModel(systemPrompt, userPrompt) {
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1536,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
        // Prefill the assistant turn to force a bare JSON object -- Claude
        // continues from here rather than wrapping it in prose/markdown.
        { role: 'assistant', content: '{' },
      ],
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    console.error('Anthropic error', upstream.status, errText);
    throw new Error('upstream_failed');
  }

  const data = await upstream.json();
  const raw = '{' + (data?.content?.[0]?.text ?? '');
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

app.post('/analyze', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server is not configured with an Anthropic API key.' });
  }

  const { question, subject } = req.body ?? {};
  if (!question || !subject?.items) {
    return res.status(400).json({ error: 'question and subject.items are required.' });
  }

  try {
    const relevant = await selectRelevantItems(subject.items, question, 60);
    const { text: timelineText, count } = buildTimelineText(relevant);
    const userPrompt = `Moderator's question: "${question}"\n\nTimeline (${count} of ${subject.items.length} total items retrieved, selected for relevance to the question):\n\n${timelineText || '(no items)'}`;

    let parsed = await callModel(SYSTEM_PROMPT, userPrompt);
    if (!parsed) parsed = { text: 'The model did not return a usable answer.', evidence: [] };
    if (!Array.isArray(parsed.evidence)) parsed.evidence = [];
    if (typeof parsed.text !== 'string') parsed.text = 'Nothing to flag here.';
    res.json(parsed);
  } catch (err) {
    console.error('analyze failed', err);
    res.status(502).json({ error: 'Failed to reach the model provider.' });
  }
});

app.post('/report', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server is not configured with an Anthropic API key.' });
  }

  const { subject } = req.body ?? {};
  if (!subject?.items) {
    return res.status(400).json({ error: 'subject.items is required.' });
  }

  try {
    const focus =
      'content revealing (a) the user explicitly stating their own job, occupation, or income about themselves in first person, or (b) content that may violate rules: harassment, hate speech, threats, spam/self-promotion, doxxing, ban evasion';
    const relevant = await selectRelevantItems(subject.items, focus, 80);
    const { text: timelineText, count } = buildTimelineText(relevant);
    const userPrompt = `Timeline (${count} of ${subject.items.length} total items retrieved, selected for relevance to the report):\n\n${timelineText || '(no items)'}`;

    let parsed = await callModel(REPORT_SYSTEM_PROMPT, userPrompt);
    if (!parsed) parsed = { selfDescribed: [], topOffensive: [] };
    if (!Array.isArray(parsed.selfDescribed)) parsed.selfDescribed = [];
    if (!Array.isArray(parsed.topOffensive)) parsed.topOffensive = [];
    res.json(parsed);
  } catch (err) {
    console.error('report failed', err);
    res.status(502).json({ error: 'Failed to reach the model provider.' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`mod-review-server listening on ${port}`));
