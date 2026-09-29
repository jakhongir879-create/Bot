import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { initTelegram, tg, haptic } from './telegram.js';
import { BottomNav, Spinner, ToastHost } from './components/ui.jsx';
import Onboarding from './components/Onboarding.jsx';
import Home from './components/Home.jsx';
import Tasks from './components/Tasks.jsx';
import TaskSheet from './components/TaskSheet.jsx';
import NewTaskSheet from './components/NewTaskSheet.jsx';
import Team from './components/Team.jsx';
import Profile from './components/Profile.jsx';

initTelegram();

const ONBOARDING_KEY = 'rahbar_onboarded';

function readOnboarded() {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}

export default function App() {
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('home');
  const [filter, setFilter] = useState('all');
  const [openTaskId, setOpenTaskId] = useState(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const data = await api.me();
      setMe(data);
      setShowOnboarding(!data.employee.onboarded && !readOnboarded());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    if (!tg?.initData) {
      setError('Bu ilova Telegram ichida ochilishi kerak. Botdagi «📱 Ilovani ochish» tugmasini bosing.');
      return;
    }
    loadMe();
  }, [loadMe]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    loadMe();
  }, [loadMe]);

  const finishOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      /* ixtiyoriy */
    }
    setShowOnboarding(false);
    api.onboarded().catch(() => {});
  };

  const closeTask = useCallback(() => setOpenTaskId(null), []);
  const closeNewTask = useCallback(() => setNewTaskOpen(false), []);

  if (error) {
    return (
      <div className="center-screen">
        <div style={{ fontSize: 56 }}>🔒</div>
        <div className="bold" style={{ fontSize: 20 }}>
          Kirish imkoni yo'q
        </div>
        <div className="muted">{error}</div>
      </div>
    );
  }
  if (!me) return <Spinner />;
  if (showOnboarding) return <Onboarding onDone={finishOnboarding} />;

  const showTeam = me.employee.role !== 'MIDDLE';
  const navigate = (nextTab, nextFilter) => {
    haptic('light');
    if (nextFilter) setFilter(nextFilter);
    setTab(nextTab);
    window.scrollTo(0, 0);
  };

  return (
    <div className="app">
      <ToastHost />
      {tab === 'home' && <Home me={me} onOpenTask={setOpenTaskId} onNavigate={navigate} />}
      {tab === 'tasks' && (
        <Tasks me={me} filter={filter} onFilter={setFilter} onOpenTask={setOpenTaskId} onNewTask={() => setNewTaskOpen(true)} refreshKey={refreshKey} />
      )}
      {tab === 'team' && showTeam && <Team onOpenTask={setOpenTaskId} refreshKey={refreshKey} />}
      {tab === 'profile' && <Profile onOpenTask={setOpenTaskId} refreshKey={refreshKey} />}
      <BottomNav tab={tab} onChange={(t) => navigate(t)} showTeam={showTeam} />
      <TaskSheet taskId={openTaskId} onClose={closeTask} onChanged={refresh} />
      <NewTaskSheet open={newTaskOpen} onClose={closeNewTask} onCreated={refresh} />
    </div>
  );
}
