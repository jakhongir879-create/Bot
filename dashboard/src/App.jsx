import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { api, auth } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Expenses from './pages/Expenses';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Debts from './pages/Debts';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

const NAV = [
  ['/', '📊', 'Bosh sahifa', 'Asosiy'],
  ['/sales', '🧾', 'Sotuvlar', 'Sotuv'],
  ['/expenses', '💸', 'Xarajatlar', 'Xarajat'],
  ['/products', '📦', 'Mahsulotlar', 'Ombor'],
  ['/customers', '👥', 'Mijozlar', 'Mijoz'],
  ['/debts', '💳', 'Qarzdorlik', 'Qarz'],
  ['/reports', '📈', 'Hisobotlar', 'Hisobot'],
  ['/settings', '⚙️', 'Sozlamalar', 'Sozlama'],
];

export default function App() {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState('');
  const [loading, setLoading] = useState(true);
  const [tgError, setTgError] = useState('');

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('logout', onLogout);

    (async () => {
      const initData = window.Telegram?.WebApp?.initData;
      try {
        if (!auth.token && initData) {
          const r = await api.post('/auth/telegram', { initData });
          auth.set(r.token);
        }
        if (auth.token) {
          const r = await api.get('/auth/me');
          setUser(r.user);
          setBusiness(r.businessName);
        }
      } catch (e) {
        if (initData) setTgError(e.message);
      } finally {
        setLoading(false);
      }
    })();
    return () => window.removeEventListener('logout', onLogout);
  }, []);

  if (loading) return <div className="loading">Yuklanmoqda...</div>;
  if (!user)
    return (
      <Login
        tgError={tgError}
        onLogin={(u, b) => {
          setUser(u);
          setBusiness(b);
        }}
      />
    );

  const logout = () => {
    auth.clear();
    setUser(null);
  };

  const nav = NAV.filter(([path]) => path !== '/settings' || user.role === 'OWNER');

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">📊 {business || 'Biznes'}</div>
        <nav className="nav">
          {nav.map(([path, icon, label]) => (
            <NavLink key={path} to={path} end={path === '/'}>
              <span>{icon}</span> {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div style={{ marginBottom: 8 }}>👤 {user.name}</div>
          <button className="btn sm" onClick={logout}>Chiqish</button>
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/products" element={<Products />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/debts" element={<Debts />} />
          <Route path="/reports" element={<Reports />} />
          {user.role === 'OWNER' && <Route path="/settings" element={<Settings onLogout={logout} />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <nav className="bottom-nav">
        {nav.map(([path, icon, , shortLabel]) => (
          <NavLink key={path} to={path} end={path === '/'}>
            <span>{icon}</span>
            {shortLabel}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
