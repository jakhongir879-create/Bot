import React, { useEffect, useState } from 'react';
import { Home, ListChecks, TrendingUp, Package, Wallet, Sparkles, Users, Settings as SettingsIcon, Menu, LogOut, Sun, Moon, Monitor } from 'lucide-react';
import { getSavedTheme, saveTheme } from './theme.js';
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
  { key: 'overview', label: 'Bosh sahifa', Icon: Home, component: Overview },
  { key: 'tasks', label: 'Vazifalar', Icon: ListChecks, component: Tasks },
  { key: 'activity', label: 'Xodimlar faolligi', Icon: TrendingUp, component: Activity },
  { key: 'stock', label: 'Sklad sverka', Icon: Package, component: Stock },
  { key: 'finance', label: 'Moliya va strategiya', Icon: Wallet, component: Finance },
  { key: 'reports', label: 'AI hisobotlar', Icon: Sparkles, component: Reports },
  { key: 'employees', label: 'Xodimlar', Icon: Users, component: Employees },
  { key: 'settings', label: 'Sozlamalar', Icon: SettingsIcon, component: Settings },
];

function currentPage() {
  const key = window.location.hash.replace('#/', '').split('?')[0];
  return PAGES.some((p) => p.key === key) ? key : 'overview';
}

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [page, setPage] = useState(currentPage());
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(getSavedTheme());
  const changeTheme = (mode) => {
    setTheme(mode);
    saveTheme(mode);
  };

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
        <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Menyu">
          <Menu size={22} strokeWidth={1.75} />
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
            <span className="ico">
              <p.Icon size={19} strokeWidth={1.75} />
            </span>
            {p.label}
          </a>
        ))}
        <div className="sidebar-footer">
          <div className="theme-switch" role="group" aria-label="Mavzu">
            {[
              ['light', Sun, 'Kunduzgi'],
              ['dark', Moon, 'Tungi'],
              ['auto', Monitor, 'Avto'],
            ].map(([mode, Icon, label]) => (
              <button key={mode} className={theme === mode ? 'active' : ''} onClick={() => changeTheme(mode)} title={label}>
                <Icon size={14} strokeWidth={1.9} />
                {label}
              </button>
            ))}
          </div>
          <button className="nav-item" onClick={logout}>
            <span className="ico">
              <LogOut size={19} strokeWidth={1.75} />
            </span>
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
