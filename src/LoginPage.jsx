import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase.js';

const messages = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/invalid-email': 'That email does not look right.',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes.',
  'auth/network-request-failed': 'No internet connection.',
};

export default function LoginPage({ notice }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(messages[err.code] || `Could not log in (${err.code}).`);
    }
    setBusy(false);
  }

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={submit}>
        <img className="login-logo" src="/logo.png" alt="NegosyoPlan logo" />
        <div className="login-title">
          NegosyoPlan <b>Admin</b>
          <small>OLEDIPO · EMBRACE</small>
        </div>
        {notice && <div className="alert red">{notice}</div>}
        {error && <div className="alert red">{error}</div>}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}