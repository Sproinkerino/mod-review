import { computeSpan } from './timeline';

export class ArchiveUnreachableError extends Error {
  constructor() {
    super('Arctic Shift archive is unreachable');
    this.name = 'ArchiveUnreachableError';
  }
}

const POSTS_URL = 'https://arctic-shift.photon-reddit.com/api/posts/search';
const COMMENTS_URL = 'https://arctic-shift.photon-reddit.com/api/comments/search';
const PAGE_LIMIT = 100;
const REQUEST_TIMEOUT_MS = 15000;

// Default retrieval caps. Most moderation questions are about recent
// behaviour, and a smaller default keeps lookups fast and keeps the
// backend's selector pass (server/index.js) working over a manageable
// index. Comments get a much bigger allowance than posts since most
// accounts comment far more often than they post.
const DEFAULT_POST_CAP = 20;
const DEFAULT_COMMENT_CAP = 500;

// Fetches most-recent-first up to `cap` items (paginating backwards in
// batches of PAGE_LIMIT), rather than the full history.
async function fetchRecent(baseUrl, username, cap) {
  const items = [];
  let before;
  while (items.length < cap) {
    const pageSize = Math.min(PAGE_LIMIT, cap - items.length);
    const pageItems = await fetchPageDesc(baseUrl, username, before, pageSize);
    if (!pageItems.length) break;
    items.push(...pageItems);
    const last = pageItems[pageItems.length - 1];
    if (!last?.created_utc) break;
    before = last.created_utc;
    if (pageItems.length < pageSize) break;
  }
  return items.slice(0, cap);
}

async function fetchPageDesc(baseUrl, username, before, pageSize) {
  const url = new URL(baseUrl);
  url.searchParams.set('author', username);
  url.searchParams.set('limit', String(pageSize));
  url.searchParams.set('sort', 'desc');
  if (before) url.searchParams.set('before', String(before));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new ArchiveUnreachableError();
    const json = await res.json();
    return Array.isArray(json) ? json : (json.data ?? []);
  } finally {
    clearTimeout(timer);
  }
}

function toPermalink(permalink) {
  if (!permalink) return null;
  return permalink.startsWith('http') ? permalink : `https://reddit.com${permalink}`;
}

function normalize(raw, type) {
  return {
    id: raw.id ?? raw.name,
    type,
    subreddit: raw.subreddit,
    title: type === 'post' ? (raw.title ?? null) : null,
    body: type === 'post' ? (raw.selftext || raw.title || '') : (raw.body ?? ''),
    score: raw.score ?? 0,
    created_utc: raw.created_utc,
    permalink: toPermalink(raw.permalink),
  };
}

// ============================================================================
// runLookup() -- Arctic Shift retrieval (live)
//
//   https://arctic-shift.photon-reddit.com/api/posts/search?author=<username>
//   https://arctic-shift.photon-reddit.com/api/comments/search?author=<username>
//
// No API key required. Fetches the most recent DEFAULT_COMMENT_CAP comments
// and DEFAULT_POST_CAP posts (not the full history -- see the module
// comment above), merged into one chronological timeline. Retains
// subreddit, title, body/selftext, score, created_utc, permalink.
//
// On timeout/network/HTTP error this throws ArchiveUnreachableError rather
// than returning an empty item list -- the caller renders "archive
// unreachable, retry" and "no history found" as two visibly different
// states. An empty result here means the account genuinely has no public
// history; a thrown error means the request failed. Do not collapse them.
// ============================================================================
export async function runLookup(username) {
  let posts, comments;
  try {
    [posts, comments] = await Promise.all([
      fetchRecent(POSTS_URL, username, DEFAULT_POST_CAP),
      fetchRecent(COMMENTS_URL, username, DEFAULT_COMMENT_CAP),
    ]);
  } catch (err) {
    if (err instanceof ArchiveUnreachableError) throw err;
    throw new ArchiveUnreachableError();
  }

  const items = [
    ...posts.map((p) => normalize(p, 'post')),
    ...comments.map((c) => normalize(c, 'comment')),
  ].sort((a, b) => a.created_utc - b.created_utc);

  return {
    name: username,
    items,
    span: computeSpan(items),
  };
}
