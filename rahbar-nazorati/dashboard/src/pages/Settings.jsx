import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { PageHead, Loading, useAsync, toast, Pill } from '../components/ui.jsx';

const DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

export default function Settings() {
  const { data, error, loading } = useAsync(() => api.settings(), []);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setForm({ ...data.company, industry: data.company.industry || '' });
  }, [data]);

  if (loading || !form) return error ? <div className="alert">{error}</div> : <Loading />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    setBusy(true);
    try {
      await api.saveSettings({ ...form, weeklyReportDay: Number(form.weeklyReportDay), monthlyReportDay: Number(form.monthlyReportDay) });
      toast('Sozlamalar saqlandi');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="Sozlamalar" />
      <div className="grid grid-2">
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Kompaniya</div>
          <label className="field"><span>Kompaniya nomi</span><input className="input" value={form.name} onChange={set('name')} /></label>
          <label className="field"><span>Sohasi</span><input className="input" value={form.industry} onChange={set('industry')} /></label>
          <label className="field"><span>Valyuta</span><input className="input" value={form.currency} onChange={set('currency')} /></label>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Rejali AI hisobotlar (Telegram orqali direktorga)</div>
          <label className="field"><span>Yuborish vaqti (Toshkent vaqti)</span><input className="input" type="time" value={form.weeklyReportTime} onChange={set('weeklyReportTime')} /></label>
          <label className="field">
            <span>Haftalik hisobot kuni</span>
            <select className="input" value={form.weeklyReportDay} onChange={set('weeklyReportDay')}>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Oylik hisobot sanasi (oyning nechanchi kuni)</span>
            <input className="input" type="number" min="1" max="28" value={form.monthlyReportDay} onChange={set('monthlyReportDay')} />
          </label>
          <div className="card-title" style={{ margin: '18px 0 12px' }}>Ertalabki brifing</div>
          <label className="checkbox" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={form.morningBriefEnabled} onChange={(e) => setForm({ ...form, morningBriefEnabled: e.target.checked })} />
            Har kuni direktor va top-menejerlarga bugungi holat va xavflarni yuborish
          </label>
          <label className="field"><span>Brifing vaqti (Toshkent vaqti)</span><input className="input" type="time" value={form.morningBriefTime} onChange={set('morningBriefTime')} /></label>
          <div className="row small">
            AI holati: {data.aiEnabled ? <Pill tone="green">Ulangan</Pill> : <Pill tone="muted">Ulanmagan (.env → ANTHROPIC_API_KEY)</Pill>}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saqlanmoqda...' : 'Saqlash'}</button>
      </div>
    </>
  );
}
