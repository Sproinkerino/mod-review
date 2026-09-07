import EvidenceBlock from './EvidenceBlock';

function fmtDate(created_utc) {
  return new Date(created_utc * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ReportView({ topSubreddits, topDownvoted, report, loading, error }) {
  return (
    <div className="report">
      <section className="report-section">
        <h2>Top subreddits</h2>
        {topSubreddits.length ? (
          <ul className="subreddit-list">
            {topSubreddits.map(({ subreddit, count }) => (
              <li key={subreddit}>
                <span>r/{subreddit}</span>
                <span className="subreddit-count">{count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-flags">No items retrieved.</p>
        )}
      </section>

      <section className="report-section">
        <h2>Self-described occupation</h2>
        <p className="report-subhead">
          Only direct, first-person statements the user made about their own job or income.
          Nothing here is inferred or estimated.
        </p>
        {loading && <p className="report-loading">Analysing…</p>}
        {error && <p className="report-error">Analysis unavailable right now.</p>}
        {!loading && !error && report && (
          report.selfDescribed.length ? (
            <div className="evidence-list">
              {report.selfDescribed.map((item, i) => (
                <div key={i} className="evidence-block">
                  <p className="evidence-excerpt">&ldquo;{item.excerpt}&rdquo;</p>
                  <div className="evidence-source">
                    <a href={item.link} target="_blank" rel="noreferrer">
                      View source
                    </a>
                    <span className="evidence-when">{item.when}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-flags">No self-described occupation or income mentions found.</p>
          )
        )}
      </section>

      <section className="report-section">
        <h2>Top 5 offensive comments</h2>
        {loading && <p className="report-loading">Analysing…</p>}
        {error && <p className="report-error">Analysis unavailable right now.</p>}
        {!loading && !error && report && (
          report.topOffensive.length ? (
            <div className="evidence-list">
              {report.topOffensive.map((ev, i) => (
                <EvidenceBlock key={i} evidence={ev} />
              ))}
            </div>
          ) : (
            <p className="no-flags">Nothing to flag here.</p>
          )
        )}
      </section>

      <section className="report-section">
        <h2>Top 5 downvoted</h2>
        {topDownvoted.length ? (
          <div className="evidence-list">
            {topDownvoted.map((item) => (
              <div key={item.id} className="evidence-block">
                <div className="evidence-header">
                  <span className="evidence-rule">r/{item.subreddit}</span>
                  <span className="score-pill">{item.score}</span>
                </div>
                <p className="evidence-excerpt">
                  &ldquo;{item.title ? `${item.title} -- ` : ''}{item.body}&rdquo;
                </p>
                <div className="evidence-source">
                  <a href={item.permalink} target="_blank" rel="noreferrer">
                    View source
                  </a>
                  <span className="evidence-when">{fmtDate(item.created_utc)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-flags">No items retrieved.</p>
        )}
      </section>
    </div>
  );
}
