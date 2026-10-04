import React, { useEffect, useState } from 'react';
import { Inbox, Home, ListChecks, Users, UserRound, Star } from 'lucide-react';
import { onBackButton } from '../telegram.js';
import { STATUS, PRIORITY, deadlineTone, formatDateTime, timeLeft, scoreTone } from '../utils.js';

export function ScoreRing({ score, size = 76, stroke = 7, label = 'ball' }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = score ?? 0;
  const tone = scoreTone(score);
  const color = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)', muted: 'var(--muted)' }[tone];
  return (
    <div className="ring" style={{ width: size, height: size }} aria-label={`Faollik bali: ${score ?? "ma'lumot yo'q"}`}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--card-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="ring-value">
        <b>{score ?? '—'}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function Pill({ tone = 'muted', children }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function StatusPill({ task }) {
  if (task.isOverdue) return <Pill tone="red">Muddati o'tgan</Pill>;
  const s = STATUS[task.status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function PriorityPill({ priority }) {
  const p = PRIORITY[priority];
  return (
    <span className="row small muted" style={{ gap: 5 }}>
      <span className={`dot ${p.tone}`} />
      {p.label}
    </span>
  );
}

export function TaskCard({ task, onClick, showAssignee, showAssigner }) {
  const tone = deadlineTone(task);
  const finished = ['BAJARILDI', 'BAJARILMADI'].includes(task.status);
  return (
    <button className="task-card" onClick={onClick}>
      <div className="row between">
        <StatusPill task={task} />
        <PriorityPill priority={task.priority} />
      </div>
      <div className="task-title">{task.title}</div>
      <div className="row between small">
        <span className={`tone-${tone}`}>{finished ? formatDateTime(task.deadline) : timeLeft(task.deadline)}</span>
        <span className="muted ellipsis" style={{ maxWidth: '55%' }}>
          {showAssignee && task.assignee ? task.assignee.fullName : showAssigner && task.assigner ? task.assigner.fullName : ''}
        </span>
      </div>
      <div className={`progress ${task.status === 'BAJARILDI' ? 'done' : ''}`}>
        <div style={{ width: `${task.progress}%` }} />
      </div>
    </button>
  );
}

export function Sheet({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const off = onBackButton(onClose);
    document.body.style.overflow = 'hidden';
    return () => {
      off();
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-handle" onClick={onClose} />
        <div className="sheet-body">
          {title && <div className="sheet-title">{title}</div>}
          {children}
        </div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </>
  );
}

export function Spinner() {
  return (
    <div className="center-screen" style={{ minHeight: 200 }}>
      <div className="spinner" />
    </div>
  );
}

export function Empty({ icon: Icon = Inbox, children }) {
  return (
    <div className="empty">
      <div className="big">
        <Icon size={44} strokeWidth={1.5} />
      </div>
      {children}
    </div>
  );
}

let toastListener = null;
export function toast(message) {
  toastListener?.(message);
}

export function ToastHost() {
  const [message, setMessage] = useState(null);
  useEffect(() => {
    let timer;
    toastListener = (m) => {
      setMessage(m);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 2600);
    };
    return () => {
      toastListener = null;
      clearTimeout(timer);
    };
  }, []);
  return message ? <div className="toast">{message}</div> : null;
}

export function BottomNav({ tab, onChange, showTeam }) {
  const items = [
    { key: 'home', Icon: Home, label: 'Bosh sahifa' },
    { key: 'tasks', Icon: ListChecks, label: 'Vazifalar' },
    ...(showTeam ? [{ key: 'team', Icon: Users, label: 'Jamoa' }] : []),
    { key: 'profile', Icon: UserRound, label: 'Profil' },
  ];
  return (
    <nav className="nav">
      {items.map((item) => (
        <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => onChange(item.key)}>
          <span className="icon">
            <item.Icon size={24} strokeWidth={tab === item.key ? 2.1 : 1.6} />
          </span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export function StarValue({ value }) {
  if (value === null || value === undefined) return '—';
  return (
    <span className="star-value">
      {value}
      <Star size={16} strokeWidth={0} fill="#f5a623" />
    </span>
  );
}

export function TrendBadge({ trend }) {
  if (!trend || trend.delta === null || trend.delta === undefined) return <span className="small muted">—</span>;
  if (trend.delta > 0) return <span className="small bold tone-green">↑ {trend.delta}</span>;
  if (trend.delta < 0) return <span className="small bold tone-red">↓ {Math.abs(trend.delta)}</span>;
  return <span className="small muted">→ 0</span>;
}
