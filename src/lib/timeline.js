export function computeSpan(items) {
  if (!items.length) return null;
  const times = items.map((i) => i.created_utc).sort((a, b) => a - b);
  const fmt = (t) =>
    new Date(t * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const start = fmt(times[0]);
  const end = fmt(times[times.length - 1]);
  return start === end ? start : `${start} - ${end}`;
}

// Deterministic, no LLM involved -- these are plain aggregates over the
// retrieved items, so there's no hallucination risk to guard against.

export function computeTopSubreddits(items, n = 5) {
  const counts = new Map();
  for (const item of items) {
    counts.set(item.subreddit, (counts.get(item.subreddit) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([subreddit, count]) => ({ subreddit, count }));
}

export function computeTopDownvoted(items, n = 5) {
  return [...items]
    .filter((i) => typeof i.score === 'number')
    .sort((a, b) => a.score - b.score)
    .slice(0, n);
}
