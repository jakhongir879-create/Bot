import React, { useState } from 'react';
import { api } from '../api.js';
import { PageHead, Loading, useAsync, Empty, Pill, AiText, toast } from '../components/ui.jsx';
import { MODULES, formatDateTime } from '../utils.js';

export default function Reports() {
  const [filters, setFilters] = useState({ module: '', from: '', to: '' });
  const [open, setOpen] = useState(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const { data, error, loading, reload } = useAsync(() => api.aiReports(filters), [JSON.stringify(filters)]);
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  const ask = async (e) => {
    e.preventDefault();
    setAsking(true);
    try {
      const res = await api.aiAsk(question.trim());
      setQuestion('');
      await reload();
      setOpen(res.report.id);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAsking(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Hisobotni o'chirasizmi?")) return;
    await api.deleteAiReport(id);
    reload();
  };

  return (
    <>
      <PageHead title="AI hisobotlar" sub="Barcha saqlangan AI tahlillar arxivi" />
      <form className="ai-card" onSubmit={ask} style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ fontSize: 17 }}>💬 AI'ga savol bering</div>
        <div className="small muted" style={{ marginBottom: 12 }}>Masalan: «Bu oy kim eng sust ishladi?» yoki «Marketing xarajati strategiyaga mosmi?»</div>
        <div className="row">
          <input className="input grow" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Savolingizni yozing..." maxLength={1000} />
          <button className="btn ai" disabled={!question.trim() || asking}>{asking ? 'Tahlil qilinmoqda...' : 'Yuborish'}</button>
        </div>
      </form>

      <div className="filters">
        <select className="input" value={filters.module} onChange={set('module')}>
          <option value="">Barcha modullar</option>
          {Object.entries(MODULES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="input" type="date" value={filters.from} onChange={set('from')} />
        <input className="input" type="date" value={filters.to} onChange={set('to')} />
      </div>
      {error && <div className="alert">{error}</div>}
      {loading && !data ? (
        <Loading />
      ) : (
        data && (
          <>
            {!data.aiEnabled && (
              <div className="alert info">AI xizmati ulanmagan. <b>.env</b> faylga <b>ANTHROPIC_API_KEY</b> yozib, backend'ni qayta ishga tushiring.</div>
            )}
            {data.reports.length ? (
              data.reports.map((r) => (
                <div key={r.id} className="card" style={{ marginBottom: 12 }}>
                  <div className="row between wrap" style={{ cursor: 'pointer' }} onClick={() => setOpen(open === r.id ? null : r.id)}>
                    <div className="row wrap">
                      <Pill tone="blue">{MODULES[r.module]}</Pill>
                      <b>{r.question ? `Savol: ${r.question}` : r.period}</b>
                    </div>
                    <div className="row">
                      <span className="small muted">{formatDateTime(r.createdAt)}</span>
                      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); remove(r.id); }} title="O'chirish">🗑</button>
                      <span className="muted">{open === r.id ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {open === r.id && (
                    <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
                      <AiText text={r.text} />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="card"><Empty>Hali AI hisobot yo'q. Istalgan bo'limdagi «🤖 AI tahlil» tugmasini bosing.</Empty></div>
            )}
          </>
        )
      )}
    </>
  );
}
