import React, { useCallback, useEffect, useState } from 'react';
import { X, Sparkles, RefreshCw, Star, BarChart3, Lightbulb, CheckCircle2 } from 'lucide-react';
import { api } from '../api.js';
import { formatDateTime, chartColors } from '../utils.js';

const AI_HEADS = [
  { emoji: '📊', Icon: BarChart3, color: '#2a78d6' },
  { emoji: '💡', Icon: Lightbulb, color: '#eda100' },
  { emoji: '✅', Icon: CheckCircle2, color: '#1baf7a' },
];

export function Loading() {
  return (
    <div className="loading">
      <div className="spinner" />
    </div>
  );
}

export function Empty({ children = "Ma'lumot yo'q" }) {
  return <div className="empty">{children}</div>;
}

export function Pill({ tone = 'muted', children }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Kpi({ label, value, foot, tone }) {
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone ? `tone-${tone}` : ''}`}>{value}</div>
      {foot && <div className="kpi-foot">{foot}</div>}
    </div>
  );
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {children && <div className="row wrap">{children}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="row between" style={{ marginBottom: 8 }}>
          <h2 className="modal-title" style={{ margin: 0 }}>
            {title}
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Yopish">
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

let toastFn = null;
export function toast(message, type = 'ok') {
  toastFn?.(message, type);
}

export function ToastHost() {
  const [state, setState] = useState(null);
  useEffect(() => {
    let timer;
    toastFn = (message, type) => {
      setState({ message, type });
      clearTimeout(timer);
      timer = setTimeout(() => setState(null), 3500);
    };
    return () => {
      toastFn = null;
      clearTimeout(timer);
    };
  }, []);
  return state ? <div className={`toast ${state.type === 'error' ? 'error' : ''}`}>{state.message}</div> : null;
}

export function useAsync(fn, deps) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await run());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [run]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}

export function AiText({ text }) {
  const lines = String(text || '').split('\n');
  return (
    <div className="ai-text">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        const head = AI_HEADS.find((h) => trimmed.startsWith(h.emoji));
        if (head && trimmed.length < 40) {
          const Icon = head.Icon;
          return (
            <span className="ai-head" key={i}>
              <Icon size={18} strokeWidth={2} color={head.color} />
              {trimmed.slice(head.emoji.length).replace(/\*/g, '').trim()}
            </span>
          );
        }
        return (
          <React.Fragment key={i}>
            {line.replace(/\*\*/g, '')}
            {i < lines.length - 1 ? '\n' : ''}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** Modul bo'yicha oxirgi AI hisobot va "AI tahlil" tugmasi */
export function AiBlock({ module, title = 'AI tahlil', compact = false }) {
  const [report, setReport] = useState(null);
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .aiLatest(module)
      .then((d) => {
        setReport(d.report);
        setEnabled(d.aiEnabled);
      })
      .catch(() => {});
  }, [module]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await api.aiGenerate(module);
      setReport(d.report);
      toast('AI tahlil tayyor');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ai-card">
      <div className="row between wrap" style={{ marginBottom: report || error || !enabled ? 14 : 0 }}>
        <div>
          <div className="card-title row" style={{ fontSize: 17, gap: 8 }}>
            <Sparkles size={18} strokeWidth={1.75} color="#5e5ce6" />
            {title}
          </div>
          <div className="small muted">
            {report ? `Oxirgi yangilanish: ${formatDateTime(report.createdAt)}` : 'Tahlil hali tayyorlanmagan'} · Tahlil → Xulosa → Tavsiyalar
          </div>
        </div>
        <button className="btn ai" onClick={generate} disabled={busy}>
          {busy ? <RefreshCw size={16} className="spin" /> : report ? <RefreshCw size={16} /> : <Sparkles size={16} />}
          {busy ? 'Tahlil qilinmoqda...' : report ? 'Yangilash' : 'AI tahlil'}
        </button>
      </div>
      {!enabled && !report && (
        <div className="alert info">
          AI xizmati ulanmagan. <b>.env</b> faylga <b>ANTHROPIC_API_KEY</b> yozib, backend'ni qayta ishga tushiring.
        </div>
      )}
      {error && <div className="alert">{error}</div>}
      {busy && !report && <Loading />}
      {report && (
        <div style={compact ? { maxHeight: 420, overflowY: 'auto' } : undefined}>
          <AiText text={report.text} />
        </div>
      )}
    </div>
  );
}

export function StarValue({ value }) {
  if (value === null || value === undefined) return '—';
  return (
    <span className="star-value">
      {value}
      <Star size={13} strokeWidth={0} fill="#f5a623" />
    </span>
  );
}

export function Stars({ count }) {
  if (!count) return '—';
  return (
    <span className="star-value">
      {Array.from({ length: count }, (_, i) => (
        <Star key={i} size={14} strokeWidth={0} fill="#f5a623" />
      ))}
    </span>
  );
}

export function StatusDot({ tone }) {
  return <span className={`status-dot ${tone}`} />;
}

export function ChartTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (!active || !payload?.length) return null;
  const c = chartColors();
  return (
    <div style={{ background: c.surface, color: c.text, padding: '10px 12px', borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,.18)', fontSize: 13, minWidth: 140 }}>
      <div style={{ color: c.axis, marginBottom: 4 }}>{labelFormatter ? labelFormatter(label) : label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="row between" style={{ gap: 16 }}>
          <span className="row" style={{ gap: 6 }}>
            <i style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.fill, display: 'inline-block' }} />
            {p.name}
          </span>
          <b>{formatter ? formatter(p.value, p) : p.value}</b>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((item) => (
        <span key={item.label}>
          <i className={item.line ? 'line' : ''} style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function ScoreBadge({ score }) {
  const tone = score === null || score === undefined ? 'muted' : score >= 75 ? 'green' : score >= 50 ? 'yellow' : 'red';
  const label = { green: 'Faol', yellow: "O'rtacha", red: 'Sust', muted: "Ma'lumot yo'q" }[tone];
  return (
    <span className="row" style={{ gap: 8 }}>
      <b style={{ minWidth: 26, fontVariantNumeric: 'tabular-nums' }}>{score ?? '—'}</b>
      <Pill tone={tone}>{label}</Pill>
    </span>
  );
}

export function useThemeVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const fn = () => setV((x) => x + 1);
    mq?.addEventListener?.('change', fn);
    window.addEventListener('themechange', fn);
    return () => {
      mq?.removeEventListener?.('change', fn);
      window.removeEventListener('themechange', fn);
    };
  }, []);
  return v;
}
