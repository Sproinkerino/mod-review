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
// Safety cap so a very active account can't hang the tab paginating
// forever. 20 pages * 100/page = up to 2000 items per content type.
const MAX_PAGES = 20;
const REQUEST_TIMEOUT_MS = 15000;

async function fetchPage(baseUrl, username, after) {
  const url = new URL(baseUrl);
  url.searchParams.set('author', username);
  url.searchParams.set('limit', String(PAGE_LIMIT));
  url.searchParams.set('sort', 'asc');
  if (after) url.searchParams.set('after', String(after));

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

async function fetchAll(baseUrl, username) {
  const items = [];
  let after;
  for (let page = 0; page < MAX_PAGES; page++) {
    const pageItems = await fetchPage(baseUrl, username, after);
    if (!pageItems.length) break;
    items.push(...pageItems);
    const last = pageItems[pageItems.length - 1];
    if (!last?.created_utc) break;
    after = last.created_utc + 1;
    if (pageItems.length < PAGE_LIMIT) break;
  }
  return items;
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
// No API key required. Paginates on created_utc via after/before, sorted
// ascending, and merges posts + comments into one chronological timeline.
// Retains subreddit, title, body/selftext, score, created_utc, permalink.
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
      fetchAll(POSTS_URL, username),
      fetchAll(COMMENTS_URL, username),
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
