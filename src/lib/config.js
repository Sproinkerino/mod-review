// Feature flags. Toggle here rather than deleting the gated code, so the
// behaviour can be switched back on without re-implementing it.

// One-free-lookup quota gate (auth required after the first lookup while
// signed out). Currently OFF -- lookups run freely regardless of
// lookupsUsed/authed. The deep-link auth requirement is independent of
// this flag and always applies (see App.jsx handlePullHistory).
export const QUOTA_ENABLED = false;

export const FREE_LOOKUPS = 1;
