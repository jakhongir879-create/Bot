import { useState } from 'react';
import { api, auth } from '../api';

export default function Login({ onLogin, tgError }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/auth/login', { password });
      auth.set(r.token);
      const me = await api.get('/auth/me');
      onLogin(me.user, me.businessName);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="box" onSubmit={submit}>
        <div className="logo">📊</div>
        <h1>Biznes Dashboard</h1>
        <p>Barcha hisobotlar bir joyda. Davom etish uchun parolni kiriting.</p>
        {tgError && <div className="alert">{tgError}</div>}
        {error && <div className="alert">{error}</div>}
        <div className="field">
          <label>Parol</label>
          <input
            className="input"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy || !password}>
          {busy ? 'Kirilmoqda...' : 'Kirish'}
        </button>
      </form>
    </div>
  );
}
