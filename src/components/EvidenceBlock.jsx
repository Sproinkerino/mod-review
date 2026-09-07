export default function EvidenceBlock({ evidence }) {
  return (
    <div className={`evidence-block severity-${evidence.severity}`}>
      <div className="evidence-header">
        <span className="evidence-rule">{evidence.rule}</span>
        <span className={`severity-pill severity-pill-${evidence.severity}`}>
          {evidence.severity}
        </span>
      </div>
      <p className="evidence-excerpt">&ldquo;{evidence.excerpt}&rdquo;</p>
      <div className="evidence-source">
        <a href={evidence.link} target="_blank" rel="noreferrer">
          View source
        </a>
        <span className="evidence-when">{evidence.when}</span>
      </div>
    </div>
  );
}
