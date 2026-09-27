import { useEffect, useState } from 'react';
import { PERIODS, todayKey } from '../utils';

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Yopish">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PeriodPicker({ value, onChange, options = PERIODS }) {
  return (
    <div className="period">
      <div className="chips">
        {options.map(([k, label]) => (
          <button
            key={k}
            className={`chip ${value.period === k ? 'active' : ''}`}
            onClick={() =>
              onChange(k === 'custom' ? { period: k, from: value.from || todayKey(), to: value.to || todayKey() } : { period: k })
            }
          >
            {label}
          </button>
        ))}
      </div>
      {value.period === 'custom' && (
        <div className="row">
          <input type="date" className="input" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <span className="muted">—</span>
          <input type="date" className="input" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </div>
      )}
    </div>
  );
}

export function Delta({ value, inverse }) {
  if (value === null || value === undefined) return <span className="delta flat">yangi</span>;
  if (value === 0) return <span className="delta flat">0%</span>;
  const good = inverse ? value < 0 : value > 0;
  return (
    <span className={`delta ${good ? 'up' : 'down'}`}>
      {value > 0 ? '▲' : '▼'} {Math.abs(value)}%
    </span>
  );
}

let toastTimer;
export function useToast() {
  const [msg, setMsg] = useState('');
  const show = (m) => {
    setMsg(m);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setMsg(''), 2600);
  };
  const node = msg ? <div className="toast">{msg}</div> : null;
  return [node, show];
}

export function Empty({ children = "Maʼlumot yo'q" }) {
  return <div className="empty">{children}</div>;
}
