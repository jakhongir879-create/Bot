import React, { useEffect, useState } from 'react';
import { Home, ListChecks, TrendingUp, Package, Wallet, Sparkles, Users, Settings as SettingsIcon, Menu, LogOut, Sun, Moon, Monitor } from 'lucide-react';
import { getSavedTheme, saveTheme } from './theme.js';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';
import { ToastHost, Loading } from './components/ui.jsx';
import { ViewerContext } from './viewer.js';
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
  { key: 'overview', label: 'Bosh sahifa', Icon: Home, component: Overview, team: true },
  { key: 'tasks', label: 'Vazifalar', Icon: ListChecks, component: Tasks, team: true },
  { key: 'activity', label: 'Xodimlar faolligi', Icon: TrendingUp, component: Activity, team: true },
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

function takeMagicToken() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('t');
  if (token) window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  return token;
}

const magicToken = takeMagicToken();

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()) && !magicToken);
  const [magicState, setMagicState] = useState(magicToken ? 'pending' : null);
  const [viewer, setViewer] = useState(null);
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

  useEffect(() => {
    if (!magicToken) return;
    api
      .magic(magicToken)
      .then((d) => {
        setToken(d.token);
        setMagicState(null);
        setAuthed(true);
      })
      .catch((e) => {
        setToken(null);
        setMagicState(e.message);
      });
  }, []);

  useEffect(() => {
    if (!authed) {
      setViewer(null);
      return;
    }
    api
      .me()
      .then(setViewer)
      .catch(() => {});
  }, [authed]);

  if (magicState === 'pending') return <Loading />;

  if (!authed) {
    return (
      <>
        <Login onSuccess={() => setAuthed(true)} notice={magicState} />
        <ToastHost />
      </>
    );
  }

  if (!viewer) return <Loading />;

  const pages = viewer.isDirector ? PAGES : PAGES.filter((p) => p.team);
  const active = pages.find((p) => p.key === page) || pages[0];
  const Current = active.component;
  const logout = () => {
    setToken(null);
    setAuthed(false);
  };

  return (
    <ViewerContext.Provider value={viewer}>
    <div className="layout">
      <header className="topbar">
        <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Menyu">
          <Menu size={22} strokeWidth={1.75} />
        </button>
        <b>{active.label}</b>
      </header>
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-logo">R</div>
          <div>
            <div className="brand-name">Rahbar nazorati</div>
            <div className="small muted">{viewer.isDirector ? 'Direktor paneli' : viewer.name}</div>
          </div>
        </div>
        {pages.map((p) => (
          <a key={p.key} href={`#/${p.key}`} className={`nav-item ${active.key === p.key ? 'active' : ''}`}>
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
        <Current key={active.key} />
      </main>
      <ToastHost />
    </div>
    </ViewerContext.Provider>
  );
}
