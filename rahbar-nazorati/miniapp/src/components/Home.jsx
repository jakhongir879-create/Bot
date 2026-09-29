import React from 'react';
import { ScoreRing, TaskCard, Empty, TrendBadge } from './ui.jsx';

export default function Home({ me, onOpenTask, onNavigate }) {
  const { employee, metrics, today, upcoming, trend } = me;
  const firstName = employee.fullName.split(' ').slice(-1)[0];
  return (
    <>
      <div className="card hero">
        <div className="grow">
          <div className="small muted">Salom 👋</div>
          <div className="hero-name ellipsis">{employee.fullName}</div>
          <div className="small muted ellipsis">{employee.position || employee.roleLabel}</div>
          <div className="row" style={{ marginTop: 8 }}>
            <span className={`pill ${metrics.status.color === 'gray' ? 'muted' : metrics.status.color}`}>{metrics.status.label}</span>
            <TrendBadge trend={trend} />
          </div>
        </div>
        <ScoreRing score={metrics.score} />
      </div>

      <div className="stats">
        <button className="stat" onClick={() => onNavigate('tasks', 'all')}>
          <div className="stat-value">{today.activeCount}</div>
          <div className="stat-label">Faol vazifalar</div>
        </button>
        <button className="stat" onClick={() => onNavigate('tasks', 'all')}>
          <div className={`stat-value ${today.todayCount ? 'tone-yellow' : ''}`}>{today.todayCount}</div>
          <div className="stat-label">Bugun deadline</div>
        </button>
        <button className="stat" onClick={() => onNavigate('tasks', 'overdue')}>
          <div className={`stat-value ${today.overdueCount ? 'tone-red' : ''}`}>{today.overdueCount}</div>
          <div className="stat-label">Muddati o'tgan</div>
        </button>
      </div>

      <div className="section-title">Yaqin deadline'lar</div>
      {upcoming.length ? (
        upcoming.map((t) => <TaskCard key={t.id} task={t} onClick={() => onOpenTask(t.id)} showAssigner />)
      ) : (
        <div className="card">
          <Empty icon="🎉">
            {firstName}, sizda hozircha faol vazifa yo'q.
          </Empty>
        </div>
      )}
    </>
  );
}
