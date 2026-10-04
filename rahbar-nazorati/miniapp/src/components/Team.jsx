import React, { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { api } from '../api.js';
import { Spinner, Empty, Sheet, TrendBadge, TaskCard, ScoreRing, StarValue } from './ui.jsx';
import TrendChart from './TrendChart.jsx';
import { initials, fmt } from '../utils.js';
import { showAlert } from '../telegram.js';

function MemberSheet({ memberId, onClose, onOpenTask }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!memberId) return;
    setData(null);
    api
      .member(memberId)
      .then(setData)
      .catch((e) => {
        showAlert(e.message);
        onClose();
      });
  }, [memberId, onClose]);
  if (!memberId) return null;
  return (
    <Sheet open onClose={onClose}>
      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="row" style={{ gap: 16, marginBottom: 12 }}>
            <div className="grow">
              <div className="sheet-title" style={{ margin: 0 }}>
                {data.member.fullName}
              </div>
              <div className="muted small">
                {data.member.position} · {data.member.department}
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <span className={`pill ${data.metrics.status.color === 'gray' ? 'muted' : data.metrics.status.color}`}>{data.metrics.status.label}</span>
                <TrendBadge trend={data.trend} />
              </div>
            </div>
            <ScoreRing score={data.metrics.score} size={70} />
          </div>
          <div className="metric-grid">
            <Metric label="Muddatida bajarish" value={data.metrics.onTimeRate === null ? '—' : `${fmt(data.metrics.onTimeRate)}%`} />
            <Metric label="O'rtacha sifat" value={<StarValue value={data.metrics.avgQuality === null ? null : fmt(data.metrics.avgQuality)} />} />
            <Metric label="Qabul qilish" value={data.metrics.avgAcceptHours === null ? '—' : `${fmt(data.metrics.avgAcceptHours)} soat`} />
            <Metric label="Muddati o'tgan" value={data.metrics.overdue} tone={data.metrics.overdue ? 'red' : ''} />
          </div>
          <div className="section-title">Haftalik trend</div>
          <div className="card">
            <TrendChart data={data.weekly} />
          </div>
          <div className="section-title">Vazifalari</div>
          {data.tasks.length ? data.tasks.map((t) => <TaskCard key={t.id} task={t} onClick={() => onOpenTask(t.id)} showAssigner />) : <Empty>Vazifa yo'q</Empty>}
        </>
      )}
    </Sheet>
  );
}

export function Metric({ label, value, tone = '' }) {
  return (
    <div className="stat">
      <div className={`stat-value ${tone ? `tone-${tone}` : ''}`} style={{ fontSize: 22 }}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function Team({ onOpenTask, refreshKey }) {
  const [members, setMembers] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const closeMember = useCallback(() => setSelected(null), []);

  useEffect(() => {
    api
      .team()
      .then((d) => setMembers(d.members))
      .catch((e) => setError(e.message));
  }, [refreshKey]);

  return (
    <>
      <div className="page-title">Jamoa</div>
      <div className="small muted" style={{ margin: '-8px 4px 12px' }}>
        Oxirgi 30 kun bo'yicha faollik bali
      </div>
      {error && <div className="card tone-red">{error}</div>}
      {!members && !error && <Spinner />}
      {members && !members.length && <Empty icon={Users}>Sizga bo'ysunuvchi xodimlar yo'q</Empty>}
      {members && members.length > 0 && (
        <div className="list">
          {members.map((m) => (
            <button key={m.id} className="list-item" onClick={() => setSelected(m.id)}>
              <div className="avatar">{initials(m.fullName)}</div>
              <div className="grow">
                <div className="bold ellipsis">{m.fullName}</div>
                <div className="small muted ellipsis">
                  {m.position || m.roleLabel}
                  {m.overdue ? <span className="tone-red"> · {m.overdue} ta muddati o'tgan</span> : null}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                  <span className={`dot ${m.status.color === 'gray' ? 'muted' : m.status.color}`} />
                  <b style={{ fontSize: 18 }}>{m.score ?? '—'}</b>
                </div>
                <TrendBadge trend={m.trend} />
              </div>
            </button>
          ))}
        </div>
      )}
      <MemberSheet memberId={selected} onClose={closeMember} onOpenTask={onOpenTask} />
    </>
  );
}
