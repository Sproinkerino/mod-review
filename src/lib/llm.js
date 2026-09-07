function fmtDate(created_utc) {
  return new Date(created_utc * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function findBySubreddit(items, keyword) {
  return items.filter((i) => (i.body || '').toLowerCase().includes(keyword));
}

// ============================================================================
// INTEGRATION POINT: requestAnswer(question, subject)
//
// Replace this mock body with a real call to an LLM. Send the merged
// timeline (chunked if it exceeds context) with a system prompt that
// instructs the model to:
//
//   - Only flag content against the supplied rule set.
//   - Cite a permalink and timestamp for every flag.
//   - Not diagnose, psychoanalyse, or speculate about the user's identity,
//     location, politics, or mental state beyond what the text explicitly
//     says.
//   - Not recommend a moderation action -- evidence only.
//
// Expected structured output: { text: string, evidence: [{ rule, excerpt,
// link, when, severity }] }.
//
// The client-side lookup counter is presentation only -- when a backend
// exists, the one-free-lookup limit must be enforced server-side against
// the account, not trusted from React state.
// ============================================================================
export async function requestAnswer(question, subject) {
  await delay(900);

  const items = subject?.items ?? [];
  const q = question.toLowerCase();

  if (q.includes('rule violation')) {
    const harassment = findBySubreddit(items, 'go back to whatever country');
    const spam = findBySubreddit(items, 'discount code');
    const evidence = [
      ...harassment.map((i) => toEvidence(i, 'Personal attacks / hate speech', 'high')),
      ...spam.map((i) => toEvidence(i, 'Spam / self-promotion', 'medium')),
    ];
    return {
      text: evidence.length
        ? `I found ${evidence.length} item${evidence.length === 1 ? '' : 's'} that appear to violate community rules, cited below.`
        : 'Nothing to flag here.',
      evidence,
    };
  }

  if (q.includes('personal attack') || q.includes('harassment')) {
    const hits = [
      ...findBySubreddit(items, 'go back to whatever country'),
      ...findBySubreddit(items, "you people are the reason"),
    ];
    const evidence = hits.map((i) => toEvidence(i, 'Personal attacks / harassment', 'high'));
    return {
      text: evidence.length
        ? `${evidence.length} comment${evidence.length === 1 ? '' : 's'} read as personal attacks rather than on-topic disagreement.`
        : 'Nothing to flag here.',
      evidence,
    };
  }

  if (q.includes('spam') || q.includes('self-promotion') || q.includes('self promotion')) {
    const hits = [
      ...findBySubreddit(items, 'dropshipping course'),
      ...findBySubreddit(items, 'discount code'),
      ...findBySubreddit(items, 'same course'),
    ];
    const evidence = hits.map((i) => toEvidence(i, 'Spam / self-promotion', 'medium'));
    return {
      text: evidence.length
        ? `There's a repeated pattern of promoting the same paid course across unrelated threads.`
        : 'Nothing to flag here.',
      evidence,
    };
  }

  if (q.includes('changed') || q.includes('last month') || q.includes('behaviour') || q.includes('behavior')) {
    return {
      text: items.length
        ? `Earlier activity in r/houseplants is neutral and on-topic. The more recent items in r/personalfinance and r/smallbusiness skew toward hostile replies and repeated promotion. I can't say what changed -- only that the tone of the later items differs from the earlier ones.`
        : 'Nothing to flag here.',
      evidence: [],
    };
  }

  if (q.includes('summar')) {
    const subs = [...new Set(items.map((i) => i.subreddit))];
    return {
      text: items.length
        ? `${items.length} items retrieved across r/${subs.join(', r/')}. Mix of plant-care discussion, course self-promotion, and a few hostile replies in finance threads. Ask a specific question and I'll cite the relevant items.`
        : 'Nothing to flag here.',
      evidence: [],
    };
  }

  // Fallback for freeform questions that don't match a canned mock branch.
  return {
    text: "I don't have a specific match for that in this mock pass -- try one of the suggested questions, or wire requestAnswer() to a real model.",
    evidence: [],
  };
}

function toEvidence(item, rule, severity) {
  return {
    rule,
    excerpt: item.body,
    link: item.permalink,
    when: fmtDate(item.created_utc),
    severity,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
