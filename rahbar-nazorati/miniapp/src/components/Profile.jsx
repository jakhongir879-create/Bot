import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Spinner, ScoreRing, TaskCard, Empty, TrendBadge } from './ui.jsx';
import TrendChart from './TrendChart.jsx';
import { Metric } from './Team.jsx';
import { fmt } from '../utils.js';

export default function Profile({ onOpenTask, refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .profile()
      .then(setData)
      .catch((e) => setError(e.message));
  }, [refreshKey]);

  if (error) return <div className="card tone-red">{error}</div>;
  if (!data) return <Spinner />;
  const { employee, metrics, metrics90, weekly, trend, completed } = data;

  return (
    <>
      <div className="page-title">Profil</div>
      <div className="card hero">
        <div className="grow">
          <div className="hero-name">{employee.fullName}</div>
          <div className="small muted">{employee.position || employee.roleLabel}</div>
          {employee.department && <div className="small muted">{employee.department}</div>}
          <div className="row" style={{ marginTop: 8 }}>
            <span className={`pill ${metrics.status.color === 'gray' ? 'muted' : metrics.status.color}`}>{metrics.status.label}</span>
            <TrendBadge trend={trend} />
          </div>
        </div>
        <ScoreRing score={metrics.score} />
      </div>

      <div className="section-title">Shaxsiy statistika (30 kun)</div>
      <div className="metric-grid">
        <Metric label="Muddatida bajarish" value={metrics.onTimeRate === null ? '—' : `${fmt(metrics.onTimeRate)}%`} />
        <Metric label="O'rtacha sifat bahosi" value={metrics.avgQuality === null ? '—' : `${fmt(metrics.avgQuality)} ⭐`} />
        <Metric label="Bajarilgan vazifalar" value={metrics.done} />
        <Metric label="Qaytarilganlar" value={metrics.returns} tone={metrics.returns ? 'orange' : ''} />
      </div>
      <div className="small muted" style={{ margin: '10px 4px 0' }}>
        90 kunlik ball: <b>{metrics90.score ?? '—'}</b> · jami vazifalar: {metrics90.total}
      </div>

      <div className="section-title">Haftalik trend</div>
      <div className="card">
        <TrendChart data={weekly} />
      </div>

      <div className="section-title">Bajarilgan vazifalar tarixi</div>
      {completed.length ? completed.map((t) => <TaskCard key={t.id} task={t} onClick={() => onOpenTask(t.id)} showAssigner />) : <Empty>Hali yakunlangan vazifa yo'q</Empty>}
    </>
  );
}
