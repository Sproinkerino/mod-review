import { MOCK_ITEMS, computeSpan } from './mockData';

export class ArchiveUnreachableError extends Error {
  constructor() {
    super('Arctic Shift archive is unreachable');
    this.name = 'ArchiveUnreachableError';
  }
}

// ============================================================================
// INTEGRATION POINT: runLookup()
//
// Replace this mock body with real calls to the Arctic Shift archive:
//
//   https://arctic-shift.photonreddit.com/api/posts/search?author=<username>
//   https://arctic-shift.photonreddit.com/api/comments/search?author=<username>
//
// No API key required. Paginate on `created_utc` using `after`/`before`,
// sorted ascending. Merge posts and comments into one chronological
// timeline. Retain: subreddit, title, body/selftext, score, created_utc,
// permalink.
//
// IMPORTANT: on timeout/network error, throw ArchiveUnreachableError (or
// let the fetch rejection propagate) rather than returning an empty item
// list. The caller renders "archive unreachable, retry" and "no history
// found" as two visibly different states -- collapsing them into one
// silently tells the moderator "no violations found" when the request
// actually just failed. Do not swallow the error.
// ============================================================================
export async function runLookup(username) {
  await delay(700);

  const normalized = username.toLowerCase();

  // Mock hooks for exercising the two non-happy-path UI states:
  if (normalized === 'erroruser') {
    throw new ArchiveUnreachableError();
  }
  if (normalized === 'emptyuser') {
    return { name: username, items: [], span: null };
  }

  return {
    name: username,
    items: MOCK_ITEMS,
    span: computeSpan(MOCK_ITEMS),
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
