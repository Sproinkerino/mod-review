export function computeSpan(items) {
  if (!items.length) return null;
  const times = items.map((i) => i.created_utc).sort((a, b) => a - b);
  const fmt = (t) =>
    new Date(t * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const start = fmt(times[0]);
  const end = fmt(times[times.length - 1]);
  return start === end ? start : `${start} - ${end}`;
}
