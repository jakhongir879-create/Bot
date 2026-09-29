import React, { useEffect, useState } from 'react';
import { getToken, setToken, setUnauthorizedHandler } from './api.js';
import { ToastHost } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import Tasks from './pages/Tasks.jsx';
import Activity from './pages/Activity.jsx';
import Stock from './pages/Stock.jsx';
import Finance from './pages/Finance.jsx';
import Reports from './pages/Reports.jsx';
import Employees from './pages/Employees.jsx';
import Settings from './pages/Settings.jsx';

const PAGES = [
  { key: 'overview', label: 'Bosh sahifa', icon: '🏠', component: Overview },
  { key: 'tasks', label: 'Vazifalar', icon: '📋', component: Tasks },
  { key: 'activity', label: 'Xodimlar faolligi', icon: '📈', component: Activity },
  { key: 'stock', label: 'Sklad sverka', icon: '📦', component: Stock },
  { key: 'finance', label: 'Moliya va strategiya', icon: '💰', component: Finance },
  { key: 'reports', label: 'AI hisobotlar', icon: '🤖', component: Reports },
  { key: 'employees', label: 'Xodimlar', icon: '👥', component: Employees },
  { key: 'settings', label: 'Sozlamalar', icon: '⚙️', component: Settings },
];

function currentPage() {
  const key = window.location.hash.replace('#/', '').split('?')[0];
  return PAGES.some((p) => p.key === key) ? key : 'overview';
}

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [page, setPage] = useState(currentPage());
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => setAuthed(false));
    const onHash = () => {
      setPage(currentPage());
      setMenuOpen(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!authed) {
    return (
      <>
        <Login onSuccess={() => setAuthed(true)} />
        <ToastHost />
      </>
    );
  }

  const Current = PAGES.find((p) => p.key === page).component;
  const logout = () => {
    setToken(null);
    setAuthed(false);
  };

  return (
    <div className="layout">
      <header className="topbar">
        <button className="icon-btn" style={{ fontSize: 20 }} onClick={() => setMenuOpen(true)} aria-label="Menyu">
          ☰
        </button>
        <b>{PAGES.find((p) => p.key === page).label}</b>
      </header>
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-logo">R</div>
          <div>
            <div className="brand-name">Rahbar nazorati</div>
            <div className="small muted">Direktor paneli</div>
          </div>
        </div>
        {PAGES.map((p) => (
          <a key={p.key} href={`#/${p.key}`} className={`nav-item ${page === p.key ? 'active' : ''}`}>
            <span className="ico">{p.icon}</span>
            {p.label}
          </a>
        ))}
        <div className="sidebar-footer">
          <button className="nav-item" onClick={logout}>
            <span className="ico">↩︎</span>
            Chiqish
          </button>
        </div>
      </aside>
      <main className="main">
        <Current key={page} />
      </main>
      <ToastHost />
    </div>
  );
}
