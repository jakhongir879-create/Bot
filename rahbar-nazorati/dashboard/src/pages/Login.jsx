import React, { useState } from 'react';
import { api, setToken } from '../api.js';

export default function Login({ onSuccess, notice }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(notice || null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api.login(login.trim(), password);
      setToken(data.token);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-logo">R</div>
        <h1 style={{ textAlign: 'center', fontSize: 24, margin: '0 0 4px' }}>Rahbar paneli</h1>
        <p className="muted" style={{ textAlign: 'center', marginTop: 0, marginBottom: 24 }}>
          Davom etish uchun tizimga kiring
        </p>
        {error && <div className="alert">{error}</div>}
        <div className="alert info small" style={{ marginBottom: 16 }}>
          Bo'lim boshlig'imisiz? Telegram botda <b>«💻 Kompyuterda ochish»</b> tugmasini bosing — parolsiz kirasiz.
        </div>
        <label className="field">
          <span>Login</span>
          <input className="input" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoFocus />
        </label>
        <label className="field">
          <span>Parol</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        <button className="btn" style={{ width: '100%', padding: 12, marginTop: 8 }} disabled={busy || !login || !password}>
          {busy ? 'Kirilmoqda...' : 'Kirish'}
        </button>
      </form>
    </div>
  );
}
