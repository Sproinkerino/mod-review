import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-haiku-4-5-20251001';

// Cap how much timeline we send per request. Full context-aware chunking
// (map-reduce over multiple chunks for very large histories) is not
// implemented in this pass -- for now we just take the most recent items
// up to a character budget, which covers typical moderation cases.
const MAX_ITEMS = 200;
const MAX_CHARS = 40000;

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

app.post('/analyze', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server is not configured with an Anthropic API key.' });
  }

  const { question, subject } = req.body ?? {};
  if (!question || !subject?.items) {
    return res.status(400).json({ error: 'question and subject.items are required.' });
  }

  const { text: timelineText, count } = buildTimelineText(subject.items);

  const userPrompt = `Moderator's question: "${question}"\n\nTimeline (${count} of ${subject.items.length} items shown, most relevant/recent first):\n\n${timelineText || '(no items)'}`;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
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
      return res.status(502).json({ error: 'Upstream model request failed.' });
    }

    const data = await upstream.json();
    const raw = '{' + (data?.content?.[0]?.text ?? '');

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { text: raw.trim() || 'The model did not return a usable answer.', evidence: [] };
    }

    if (!Array.isArray(parsed.evidence)) parsed.evidence = [];
    if (typeof parsed.text !== 'string') parsed.text = 'Nothing to flag here.';

    res.json(parsed);
  } catch (err) {
    console.error('analyze failed', err);
    res.status(502).json({ error: 'Failed to reach the model provider.' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`mod-review-server listening on ${port}`));
