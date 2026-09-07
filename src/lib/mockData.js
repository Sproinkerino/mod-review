// Deterministic mock dataset used until runLookup() / requestAnswer() are
// wired to real services. See lib/arcticShift.js and lib/llm.js.
//
// Timestamps are generated relative to "now" (days-ago offsets) rather than
// hardcoded, so the date span always looks current instead of drifting into
// the past as real time moves on.
const daysAgo = (d) => Math.floor(Date.now() / 1000) - d * 86400;

export const MOCK_ITEMS = [
  {
    id: 't3_a1b2c3',
    type: 'post',
    subreddit: 'houseplants',
    title: 'Finally got my monstera to unfurl a new leaf!',
    body: 'Took about six weeks but the humidity tray really helped.',
    score: 214,
    created_utc: daysAgo(520),
    permalink: 'https://reddit.com/r/houseplants/comments/a1b2c3/finally_got_my_monstera/',
  },
  {
    id: 't1_d4e5f6',
    type: 'comment',
    subreddit: 'houseplants',
    title: null,
    body: 'Have you tried a moisture meter instead of guessing? Way more reliable than the finger test.',
    score: 12,
    created_utc: daysAgo(470),
    permalink: 'https://reddit.com/r/houseplants/comments/x9y8z7/comment/d4e5f6/',
  },
  {
    id: 't1_g7h8i9',
    type: 'comment',
    subreddit: 'personalfinance',
    title: null,
    body: "Nobody with a functioning brain thinks renting is 'throwing money away,' you people are the reason this sub is a joke.",
    score: -8,
    created_utc: daysAgo(300),
    permalink: 'https://reddit.com/r/personalfinance/comments/m1n2o3/comment/g7h8i9/',
  },
  {
    id: 't3_j1k2l3',
    type: 'post',
    subreddit: 'smallbusiness',
    title: 'Check out my new dropshipping course (link in comments)',
    body: 'I made $40k in 3 months and want to show you how. DM me for the discount code, limited spots.',
    score: 1,
    created_utc: daysAgo(150),
    permalink: 'https://reddit.com/r/smallbusiness/comments/j1k2l3/check_out_my_new_course/',
  },
  {
    id: 't1_p4q5r6',
    type: 'comment',
    subreddit: 'smallbusiness',
    title: null,
    body: 'Same course, same pitch, different thread. Link in my profile if mods delete this one.',
    score: -15,
    created_utc: daysAgo(148),
    permalink: 'https://reddit.com/r/smallbusiness/comments/s7t8u9/comment/p4q5r6/',
  },
  {
    id: 't1_v1w2x3',
    type: 'comment',
    subreddit: 'personalfinance',
    title: null,
    body: "Go back to whatever country you're from if you don't understand how mortgages work here.",
    score: -42,
    created_utc: daysAgo(60),
    permalink: 'https://reddit.com/r/personalfinance/comments/y4z5a6/comment/v1w2x3/',
  },
  {
    id: 't3_b7c8d9',
    type: 'post',
    subreddit: 'houseplants',
    title: 'Repotting schedule for a 3 year old fiddle leaf fig?',
    body: 'Roots are starting to poke out the drainage holes, is spring still the best window?',
    score: 56,
    created_utc: daysAgo(10),
    permalink: 'https://reddit.com/r/houseplants/comments/b7c8d9/repotting_schedule/',
  },
];

export function computeSpan(items) {
  if (!items.length) return null;
  const times = items.map((i) => i.created_utc).sort((a, b) => a - b);
  const fmt = (t) =>
    new Date(t * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const start = fmt(times[0]);
  const end = fmt(times[times.length - 1]);
  return start === end ? start : `${start} - ${end}`;
}
