import { useEffect, useState } from 'react';
import SearchScreen from './components/SearchScreen';
import ChatScreen from './components/ChatScreen';
import AuthGateModal from './components/AuthGateModal';
import { runLookup, ArchiveUnreachableError } from './lib/arcticShift';
import { requestAnswer, requestReport } from './lib/llm';
import { QUOTA_ENABLED, FREE_LOOKUPS } from './lib/config';

const USERNAME_RE = /^[A-Za-z0-9_-]{3,20}$/;

function parseUsernameFromLocation() {
  const { pathname, search } = window.location;

  const pathMatch = pathname.match(/^\/u\/([^/?#]+)/i);
  let raw = pathMatch ? pathMatch[1] : new URLSearchParams(search).get('user');
  if (!raw) return null;

  raw = decodeURIComponent(raw).trim();
  if (raw.toLowerCase().startsWith('u/')) raw = raw.slice(2);

  return USERNAME_RE.test(raw) ? raw : null;
}

export default function App() {
  const [stage, setStage] = useState('search');
  const [username, setUsername] = useState('');
  const [subject, setSubject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [lookupsUsed, setLookupsUsed] = useState(0);
  const [authed, setAuthed] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // Set when the current username came from a deep link (/u/name or
  // ?user=name). Per spec: a deep link prefills the field only -- it must
  // never auto-run the lookup, and if the visitor is signed out it always
  // requires sign-in on click, even on their first ever lookup. This keeps
  // a pasted link inert (a form, not a generated dossier) and makes every
  // profile run attributable to a signed-in account.
  const [fromDeepLink, setFromDeepLink] = useState(false);

  useEffect(() => {
    const found = parseUsernameFromLocation();
    if (found) {
      setUsername(found);
      setFromDeepLink(true);
    }
    // Deliberately no lookup call here -- deep links prefill only.
  }, []);

  async function performLookup() {
    setLoading(true);
    setError(false);
    try {
      // INTEGRATION POINT: runLookup() -- see src/lib/arcticShift.js
      const result = await runLookup(username);
      setLookupsUsed((n) => n + 1);
      setSubject(result);
      setMessages([
        {
          role: 'assistant',
          text: result.items.length
            ? `Retrieved ${result.items.length} item${result.items.length === 1 ? '' : 's'} spanning ${result.span}. The report above covers the highlights -- ask me anything else about this history.`
            : 'No public history was found for this account. There is nothing to ask about yet.',
        },
      ]);
      setStage('chat');
      setFromDeepLink(false);
      window.history.replaceState(null, '', `/u/${encodeURIComponent(username.trim())}`);

      if (result.items.length) {
        setReport(null);
        setReportError(false);
        setReportLoading(true);
        requestReport(result)
          .then(setReport)
          .catch(() => setReportError(true))
          .finally(() => setReportLoading(false));
      }
    } catch (err) {
      if (err instanceof ArchiveUnreachableError) {
        setError(true);
      } else {
        throw err;
      }
    } finally {
      setLoading(false);
    }
  }

  function handlePullHistory() {
    const needsAuth =
      !authed && (fromDeepLink || (QUOTA_ENABLED && lookupsUsed >= FREE_LOOKUPS));
    if (needsAuth) {
      setGateOpen(true);
      return;
    }
    performLookup();
  }

  function handleAuthed() {
    setAuthed(true);
    setGateOpen(false);
    performLookup();
  }

  async function handleAsk(question) {
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setDraft('');
    setThinking(true);
    try {
      const answer = await requestAnswer(question, subject);
      setMessages((m) => [...m, { role: 'assistant', text: answer.text, evidence: answer.evidence }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: 'The analysis backend is unavailable right now. Try again in a moment.',
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  function handleNewLookup() {
    setStage('search');
    setUsername('');
    setSubject(null);
    setMessages([]);
    setDraft('');
    setError(false);
    setFromDeepLink(false);
    setReport(null);
    setReportError(false);
    setReportLoading(false);
    window.history.replaceState(null, '', '/');
  }

  return (
    <>
      {stage === 'search' ? (
        <SearchScreen
          username={username}
          onUsernameChange={setUsername}
          onSubmit={handlePullHistory}
          loading={loading}
          error={error}
          lookupsUsed={lookupsUsed}
          authed={authed}
        />
      ) : (
        <ChatScreen
          subject={subject}
          messages={messages}
          draft={draft}
          onDraftChange={setDraft}
          onAsk={handleAsk}
          onChipClick={handleAsk}
          thinking={thinking}
          onNewLookup={handleNewLookup}
          report={report}
          reportLoading={reportLoading}
          reportError={reportError}
        />
      )}

      <AuthGateModal
        open={gateOpen}
        onDismiss={() => setGateOpen(false)}
        onAuthed={handleAuthed}
      />
    </>
  );
}
