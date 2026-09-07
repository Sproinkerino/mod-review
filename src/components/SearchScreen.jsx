const FREE_LOOKUPS = 1;

export default function SearchScreen({
  username,
  onUsernameChange,
  onSubmit,
  loading,
  error,
  lookupsUsed,
  authed,
}) {
  function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || loading) return;
    onSubmit();
  }

  const quotaLabel = authed
    ? 'Signed in'
    : `${Math.max(FREE_LOOKUPS - lookupsUsed, 0)} free lookup${
        Math.max(FREE_LOOKUPS - lookupsUsed, 0) === 1 ? '' : 's'
      } left`;

  return (
    <div className="screen search-screen">
      <div className="top-bar">
        <span className="quota-indicator">{quotaLabel}</span>
      </div>

      <div className="search-center">
        <h1>Mod Review</h1>
        <p className="supporting-copy">
          Look up a Reddit user's public post and comment history and ask cited questions about
          it.
        </p>

        <form onSubmit={handleSubmit} className="search-form">
          <input
            type="text"
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            placeholder="u/username"
            aria-label="Reddit username"
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={loading || !username.trim()}>
            {loading ? 'Pulling history…' : 'Pull history'}
          </button>
        </form>

        {error && (
          <div className="lookup-error" role="alert">
            <p>The Arctic Shift archive is unreachable right now. This is not a result — it's a failed request.</p>
            <button type="button" className="btn btn-secondary" onClick={onSubmit}>
              Retry
            </button>
          </div>
        )}

        <p className="footer-note">The tool gathers and cites; the moderator decides.</p>
      </div>
    </div>
  );
}
