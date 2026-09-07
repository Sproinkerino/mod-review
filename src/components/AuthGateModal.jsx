import { useState } from 'react';

export default function AuthGateModal({ open, onDismiss, onAuthed }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!open) return null;

  function handleCreateAccount(e) {
    e.preventDefault();
    // Mock auth: no backend in this pass. Any non-empty email/password
    // is accepted so the flow can be exercised end to end.
    if (!email.trim() || !password.trim()) return;
    onAuthed();
  }

  return (
    <div className="modal-backdrop" onClick={onDismiss}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-gate-heading"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="auth-gate-heading">Sign in to keep reviewing</h2>
        <p className="modal-body">
          Your free lookup has been used. Sign in to keep pulling case histories.
        </p>

        <button type="button" className="btn btn-google" disabled>
          Continue with Google <span className="coming-soon">(coming soon)</span>
        </button>

        <div className="modal-divider" role="separator">
          <span>or</span>
        </div>

        <form onSubmit={handleCreateAccount}>
          <label className="field-label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label className="field-label" htmlFor="auth-password">
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" className="btn btn-primary">
            Create account
          </button>
        </form>

        <button type="button" className="link-button dismiss-link" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
