import { useEffect, useMemo, useRef } from 'react';
import EvidenceBlock from './EvidenceBlock';
import ReportView from './ReportView';
import { computeTopSubreddits, computeTopDownvoted } from '../lib/timeline';

const SUGGESTED_QUESTIONS = [
  'Any rule violations here?',
  'Show personal attacks or harassment',
  'Is there a spam or self-promotion pattern?',
  'Has their behaviour changed in the last month?',
  'Summarise their activity',
];

export default function ChatScreen({
  subject,
  messages,
  draft,
  onDraftChange,
  onAsk,
  onChipClick,
  thinking,
  onNewLookup,
  report,
  reportLoading,
  reportError,
}) {
  const threadRef = useRef(null);
  const topSubreddits = useMemo(() => computeTopSubreddits(subject.items), [subject.items]);
  const topDownvoted = useMemo(() => computeTopDownvoted(subject.items), [subject.items]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!draft.trim() || thinking) return;
    onAsk(draft.trim());
  }

  return (
    <div className="screen chat-screen">
      <header className="case-header">
        <div>
          <div className="case-username">u/{subject.name}</div>
          <div className="case-meta">
            {subject.items.length} item{subject.items.length === 1 ? '' : 's'}
            {subject.span ? ` · ${subject.span}` : ''}
          </div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onNewLookup}>
          New lookup
        </button>
      </header>

      <div className="message-thread" ref={threadRef}>
        <ReportView
          topSubreddits={topSubreddits}
          topDownvoted={topDownvoted}
          report={report}
          loading={reportLoading}
          error={reportError}
        />

        <h2 className="followup-heading">Follow-up questions</h2>

        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`message message-${msg.role}`}>
              <p>{msg.text}</p>
              {msg.evidence &&
                (msg.evidence.length ? (
                  <div className="evidence-list">
                    {msg.evidence.map((ev, j) => (
                      <EvidenceBlock key={j} evidence={ev} />
                    ))}
                  </div>
                ) : (
                  <p className="no-flags">Nothing to flag here.</p>
                ))}
            </div>
            {i === 0 && msg.role === 'assistant' && (
              <div className="chip-row">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="chip"
                    onClick={() => onChipClick(q)}
                    disabled={thinking}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {thinking && (
          <div className="message message-assistant typing-indicator" aria-live="polite">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        )}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <input
          type="text"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Ask about this history…"
          aria-label="Ask a question"
          disabled={thinking}
        />
        <button type="submit" className="btn btn-primary" disabled={thinking || !draft.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}
