import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, Sparkles } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { api } from '../api.js';
import { PageHead, AiBlock, Loading, useAsync, Modal, Empty, toast, Pill, Kpi, ChartTooltip, Legend, AiText, useThemeVersion } from '../components/ui.jsx';
import { money, compactMoney, pct, num, monthLabel, formatDate, isoDay, currentMonthKey, chartColors, GOAL_STATUS, VERDICTS } from '../utils.js';

function PlanFactChart({ title, rows, planKey, factKey }) {
  const c = chartColors();
  const data = rows.map((r) => ({ month: r.month, fact: r.hasFact ? r[factKey] : null, plan: r[planKey] }));
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      <Legend items={[{ label: 'Fakt', color: c.s1 }, { label: 'Reja', color: c.s2, line: true }]} />
      <div className="chart sm">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={c.grid} />
            <ReferenceLine y={0} stroke={c.baseline} />
            <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, true)} tick={{ fontSize: 12, fill: c.axis }} tickLine={false} axisLine={{ stroke: c.baseline }} />
            <YAxis tickFormatter={compactMoney} tick={{ fontSize: 12, fill: c.axis }} tickLine={false} axisLine={false} width={84} />
            <Tooltip content={<ChartTooltip formatter={(v) => (v === null ? '—' : money(v))} labelFormatter={(m) => monthLabel(m)} />} cursor={{ fill: c.grid, opacity: 0.4 }} />
            <Bar dataKey="fact" name="Fakt" fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Line dataKey="plan" name="Reja" stroke={c.s2} strokeWidth={2} dot={{ r: 4, fill: c.s2, stroke: c.surface, strokeWidth: 2 }} type="monotone" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EntryModal({ open, onClose, entries, categories, onSaved }) {
  const [month, setMonth] = useState(currentMonthKey());
  const [rows, setRows] = useState([]);
  const [newCat, setNewCat] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const existing = entries.filter((e) => e.month === month);
    const base = [
      ...(existing.some((e) => e.type === 'TUSHUM') ? [] : [{ type: 'TUSHUM', category: 'Savdo' }]),
      ...(existing.some((e) => e.type === 'TANNARX') ? [] : [{ type: 'TANNARX', category: 'Tovar tannarxi' }]),
      ...categories.filter((cat) => !existing.some((e) => e.type === 'XARAJAT' && e.category === cat)).map((cat) => ({ type: 'XARAJAT', category: cat })),
    ].map((r) => ({ ...r, planAmount: '', factAmount: '' }));
    setRows([...existing.map((e) => ({ type: e.type, category: e.category, planAmount: String(e.planAmount), factAmount: String(e.factAmount) })), ...base]);
  }, [open, month, entries, categories]);

  const update = (i, key, value) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: value.replace(/[^\d]/g, '') } : r)));

  const save = async () => {
    setBusy(true);
    try {
      for (const r of rows) {
        if (r.planAmount === '' && r.factAmount === '') continue;
        await api.saveEntry({ month, type: r.type, category: r.category, planAmount: Number(r.planAmount || 0), factAmount: Number(r.factAmount || 0) });
      }
      toast("Moliyaviy ma'lumotlar saqlandi");
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const typeLabel = { TUSHUM: 'Tushum', TANNARX: 'Tannarx', XARAJAT: 'Xarajat' };
  return (
    <Modal open={open} onClose={onClose} wide title="Moliyaviy ma'lumot kiritish">
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <label className="field" style={{ margin: 0 }}>
          <span>Oy</span>
          <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <div className="small muted grow" style={{ alignSelf: 'flex-end' }}>
          Summalarni so'mda, bo'sh joysiz kiriting. Bo'sh qatorlar saqlanmaydi.
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Turi</th><th>Toifa</th><th className="num">Reja (so'm)</th><th className="num">Fakt (so'm)</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.type}-${r.category}`}>
                <td><Pill tone={r.type === 'TUSHUM' ? 'green' : r.type === 'TANNARX' ? 'orange' : 'blue'}>{typeLabel[r.type]}</Pill></td>
                <td>{r.category}</td>
                <td className="num"><input className="input" style={{ textAlign: 'right', minWidth: 140 }} inputMode="numeric" value={r.planAmount} onChange={(e) => update(i, 'planAmount', e.target.value)} placeholder="0" /></td>
                <td className="num"><input className="input" style={{ textAlign: 'right', minWidth: 140 }} inputMode="numeric" value={r.factAmount} onChange={(e) => update(i, 'factAmount', e.target.value)} placeholder="0" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ margin: '12px 0' }}>
        <input className="input" style={{ maxWidth: 240 }} placeholder="Yangi xarajat toifasi" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
        <button
          className="btn ghost sm"
          disabled={!newCat.trim()}
          onClick={() => {
            setRows((rs) => [...rs, { type: 'XARAJAT', category: newCat.trim(), planAmount: '', factAmount: '' }]);
            setNewCat('');
          }}
        >
          + Qo'shish
        </button>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Bekor qilish</button>
        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saqlanmoqda...' : 'Saqlash'}</button>
      </div>
    </Modal>
  );
}

function GoalModal({ goal, metrics, categories, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (goal) setForm({ name: goal.name || '', metric: goal.metric || 'SOF_MARJA', category: goal.category || categories[0], condition: goal.condition || 'GTE', targetValue: goal.targetValue ?? '', period: goal.period || `${new Date().getFullYear()}-yil` });
  }, [goal, categories]);
  if (!goal || !form) return null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async () => {
    try {
      await api.saveGoal({ ...form, targetValue: Number(String(form.targetValue).replace(',', '.')) }, goal.id);
      toast('Maqsad saqlandi');
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <Modal open onClose={onClose} title={goal.id ? 'Maqsadni tahrirlash' : 'Yangi strategik maqsad'}>
      <label className="field"><span>Maqsad nomi</span><input className="input" value={form.name} onChange={set('name')} placeholder="Masalan: Sof marjani 12% dan yuqori ushlab turish" /></label>
      <div className="form-grid">
        <label className="field">
          <span>Ko'rsatkich</span>
          <select className="input" value={form.metric} onChange={set('metric')}>
            {Object.entries(metrics).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </label>
        {form.metric === 'TOIFA_ULUSHI' && (
          <label className="field">
            <span>Xarajat toifasi</span>
            <select className="input" value={form.category} onChange={set('category')}>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </label>
        )}
        <label className="field">
          <span>Shart</span>
          <select className="input" value={form.condition} onChange={set('condition')}>
            <option value="GTE">≥ (kamida)</option>
            <option value="LTE">≤ (ko'pi bilan)</option>
          </select>
        </label>
        <label className="field"><span>Maqsadli qiymat ({metrics[form.metric]?.unit})</span><input className="input" value={form.targetValue} onChange={set('targetValue')} /></label>
        <label className="field"><span>Davr</span><input className="input" value={form.period} onChange={set('period')} /></label>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Bekor qilish</button>
        <button className="btn" onClick={save}>Saqlash</button>
      </div>
    </Modal>
  );
}

function DecisionModal({ decision, metrics, categories, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (decision) setForm({ date: decision.date ? isoDay(decision.date) : isoDay(), title: decision.title || '', description: decision.description || '', metric: decision.metric || 'TUSHUM_OSISHI', category: decision.category || categories[0], expectedResult: decision.expectedResult || '' });
  }, [decision, categories]);
  if (!decision || !form) return null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async () => {
    try {
      await api.saveDecision(form, decision.id);
      toast('Qaror saqlandi');
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <Modal open onClose={onClose} title={decision.id ? 'Qarorni tahrirlash' : 'Yangi taktik qaror'}>
      <div className="form-grid">
        <label className="field"><span>Sana</span><input className="input" type="date" value={form.date} onChange={set('date')} /></label>
        <label className="field">
          <span>Ta'sir qiladigan ko'rsatkich</span>
          <select className="input" value={form.metric} onChange={set('metric')}>
            {Object.entries(metrics).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </label>
        {form.metric === 'TOIFA_ULUSHI' && (
          <label className="field">
            <span>Xarajat toifasi</span>
            <select className="input" value={form.category} onChange={set('category')}>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </label>
        )}
      </div>
      <label className="field"><span>Qaror nomi</span><input className="input" value={form.title} onChange={set('title')} /></label>
      <label className="field"><span>Tavsif</span><textarea className="input" value={form.description} onChange={set('description')} /></label>
      <label className="field"><span>Kutilgan natija</span><input className="input" value={form.expectedResult} onChange={set('expectedResult')} placeholder="Masalan: tushum o'sishi kamida 4%" /></label>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Bekor qilish</button>
        <button className="btn" onClick={save}>Saqlash</button>
      </div>
    </Modal>
  );
}

function fmtMetric(value, unit) {
  if (value === null || value === undefined) return '—';
  return unit === "so'm" ? money(value) : `${num(value)}${unit}`;
}

export default function Finance() {
  useThemeVersion();
  const { data, error, loading, reload } = useAsync(() => api.finance(), []);
  const [entryOpen, setEntryOpen] = useState(false);
  const [goal, setGoal] = useState(null);
  const [decision, setDecision] = useState(null);
  const [evaluating, setEvaluating] = useState(null);
  const [commentOf, setCommentOf] = useState(null);

  const categories = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.expenseCategories);
    data.entries.filter((e) => e.type === 'XARAJAT').forEach((e) => set.add(e.category));
    return [...set];
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error) return <div className="alert">{error}</div>;

  const rows = data.months.slice(-12);
  const cur = data.current;
  const structureTotal = data.expenseStructure.reduce((s, x) => s + x.amount, 0);
  const c = chartColors();

  const evaluate = async (id) => {
    setEvaluating(id);
    try {
      const res = await api.evaluateDecision(id);
      toast(res.source === 'ai' ? 'AI baho tayyor' : 'Avtomatik hisob-kitob asosida baholandi');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setEvaluating(null);
    }
  };

  const removeGoal = async (id) => {
    if (!window.confirm("Maqsadni o'chirasizmi?")) return;
    await api.deleteGoal(id);
    reload();
  };

  const removeDecision = async (id) => {
    if (!window.confirm("Qarorni o'chirasizmi?")) return;
    await api.deleteDecision(id);
    reload();
  };

  return (
    <>
      <PageHead title="Moliya va strategiya" sub="Reja va fakt, strategik maqsadlar va taktik qarorlar natijasi">
        <button className="btn" onClick={() => setEntryOpen(true)}>+ Moliyaviy ma'lumot</button>
      </PageHead>

      {cur ? (
        <div className="grid grid-kpi">
          <Kpi label={`Tushum · ${monthLabel(cur.month)}`} value={compactMoney(cur.revenue)} foot={`Reja: ${compactMoney(cur.revenuePlan)}`} />
          <Kpi label="Reja bajarilishi" value={pct(cur.planExecution)} tone={cur.planExecution >= 100 ? 'green' : cur.planExecution >= 90 ? 'yellow' : 'red'} foot={`O'sish: ${pct(cur.revenueGrowth)}`} />
          <Kpi label="Sof foyda" value={compactMoney(cur.netProfit)} foot={`Reja: ${compactMoney(cur.netProfitPlan)}`} tone={cur.netProfit < 0 ? 'red' : undefined} />
          <Kpi label="Sof marja" value={pct(cur.netMargin)} foot={`Yalpi marja: ${pct(cur.grossMargin)}`} />
          <Kpi label="Xarajatlar ulushi" value={pct(cur.expenseShare)} foot={`Xarajatlar: ${compactMoney(cur.expenses)}`} />
        </div>
      ) : (
        <div className="alert info">Moliyaviy ma'lumot kiritilmagan. «+ Moliyaviy ma'lumot» tugmasini bosing.</div>
      )}

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <PlanFactChart title="Tushum" rows={rows} planKey="revenuePlan" factKey="revenue" />
        <PlanFactChart title="Xarajatlar (operatsion)" rows={rows} planKey="expensesPlan" factKey="expenses" />
        <PlanFactChart title="Sof foyda" rows={rows} planKey="netProfitPlan" factKey="netProfit" />
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-title">Xarajatlar tuzilmasi</div>
          <div className="card-sub">Oxirgi 3 oy fakti bo'yicha</div>
          {data.expenseStructure.length ? (
            data.expenseStructure.map((x) => {
              const share = structureTotal ? (x.amount / structureTotal) * 100 : 0;
              return (
                <div key={x.category} style={{ padding: '6px 0' }}>
                  <div className="row between small">
                    <span>{x.category}</span>
                    <span><b>{compactMoney(x.amount)}</b> <span className="muted">· {num(share)}%</span></span>
                  </div>
                  <div className="bar-track" style={{ height: 8 }}>
                    <div style={{ width: `${share}%`, background: c.s1 }} />
                  </div>
                </div>
              );
            })
          ) : (
            <Empty />
          )}
        </div>
        <div className="card">
          <div className="card-title">Oyma-oy ko'rsatkichlar</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Oy</th><th className="num">Tushum</th><th className="num">Reja %</th><th className="num">Sof foyda</th><th className="num">Marja</th><th className="num">Xarajat ulushi</th></tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.month}>
                    <td>{monthLabel(r.month)}</td>
                    <td className="num">{r.hasFact ? compactMoney(r.revenue) : <span className="muted">reja</span>}</td>
                    <td className="num">{r.hasFact ? pct(r.planExecution) : '—'}</td>
                    <td className={`num ${r.netProfit < 0 && r.hasFact ? 'neg' : ''}`}>{r.hasFact ? compactMoney(r.netProfit) : '—'}</td>
                    <td className="num">{r.hasFact ? pct(r.netMargin) : '—'}</td>
                    <td className="num">{r.hasFact ? pct(r.expenseShare) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="row between" style={{ marginTop: 32, marginBottom: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>Strategik maqsadlar</div>
        <button className="btn secondary sm" onClick={() => setGoal({})}>+ Maqsad qo'shish</button>
      </div>
      <div className="grid grid-3">
        {data.goals.map((g) => {
          const s = GOAL_STATUS[g.status];
          return (
            <div key={g.id} className="card goal-card">
              <div className="row between">
                <span className="row" style={{ gap: 8 }}>
                  <span className={`status-icon ${s.tone}`}>{s.icon}</span>
                  <b className={`tone-${s.tone}`}>{s.label}</b>
                </span>
                <span>
                  <button className="icon-btn" onClick={() => setGoal(g)} title="Tahrirlash"><Pencil size={16} strokeWidth={1.75} /></button>
                  <button className="icon-btn" onClick={() => removeGoal(g.id)} title="O'chirish"><Trash2 size={16} strokeWidth={1.75} /></button>
                </span>
              </div>
              <div className="bold">{g.name}</div>
              <div className="small muted">{g.metricLabel}{g.category ? ` (${g.category})` : ''} · {g.period}</div>
              <div className="row" style={{ alignItems: 'baseline' }}>
                <span className="goal-value">{fmtMetric(g.currentValue, g.unit)}</span>
                <span className="muted small">maqsad: {g.condition === 'GTE' ? '≥' : '≤'} {fmtMetric(g.targetValue, g.unit)}</span>
              </div>
              <div className="small muted">{g.basis.length ? `${g.basis.map((m) => monthLabel(m, true)).join(', ')} o'rtachasi` : ''}</div>
            </div>
          );
        })}
      </div>
      {!data.goals.length && <div className="card"><Empty>Strategik maqsadlar kiritilmagan</Empty></div>}

      <div className="row between" style={{ marginTop: 32, marginBottom: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>Taktik qarorlar</div>
        <button className="btn secondary sm" onClick={() => setDecision({})}>+ Qaror qo'shish</button>
      </div>
      <div className="card">
        <div className="card-sub">Qarordan oldingi 2 oy va keyingi 2 oyning tegishli ko'rsatkichi solishtiriladi</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sana</th>
                <th>Qaror</th>
                <th>Ko'rsatkich</th>
                <th className="num">Oldin (2 oy)</th>
                <th className="num">Keyin (2 oy)</th>
                <th className="num">O'zgarish</th>
                <th>Hisob-kitob</th>
                <th>AI bahosi</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.decisions.map((d) => {
                const good = d.change === null ? null : d.better === 'up' ? d.change > 0 : d.change < 0;
                return (
                  <tr key={d.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(d.date)}</td>
                    <td style={{ minWidth: 200 }}>
                      <b>{d.title}</b>
                      {d.expectedResult && <div className="small muted">Kutilgan: {d.expectedResult}</div>}
                    </td>
                    <td className="small">{d.metricLabel}{d.category ? ` (${d.category})` : ''}</td>
                    <td className="num">{fmtMetric(d.before, d.unit)}</td>
                    <td className="num">{fmtMetric(d.after, d.unit)}</td>
                    <td className={`num ${good === true ? 'pos' : good === false ? 'neg' : ''}`}>{d.change === null ? '—' : `${d.change > 0 ? '+' : ''}${fmtMetric(d.change, d.unit)}`}</td>
                    <td><Pill tone={VERDICTS[d.autoVerdict].tone}>{VERDICTS[d.autoVerdict].label}</Pill></td>
                    <td>
                      {d.aiVerdict ? (
                        <button onClick={() => setCommentOf(d)} title="Izohni ko'rish">
                          <Pill tone={VERDICTS[d.aiVerdict].tone}>{VERDICTS[d.aiVerdict].label} ›</Pill>
                        </button>
                      ) : (
                        <span className="muted small">—</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn ai sm" onClick={() => evaluate(d.id)} disabled={evaluating === d.id}>
                        {evaluating === d.id ? '...' : <><Sparkles size={14} /> Baholash</>}
                      </button>
                      <button className="icon-btn" onClick={() => setDecision(d)} title="Tahrirlash"><Pencil size={16} strokeWidth={1.75} /></button>
                      <button className="icon-btn" onClick={() => removeDecision(d.id)} title="O'chirish"><Trash2 size={16} strokeWidth={1.75} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!data.decisions.length && <Empty>Taktik qarorlar kiritilmagan</Empty>}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <AiBlock module="MOLIYA" title="AI tahlil: moliya va strategiya" compact />
      </div>

      <EntryModal open={entryOpen} onClose={() => setEntryOpen(false)} entries={data.entries} categories={categories} onSaved={reload} />
      <GoalModal goal={goal} metrics={data.metrics} categories={categories} onClose={() => setGoal(null)} onSaved={reload} />
      <DecisionModal decision={decision} metrics={data.metrics} categories={categories} onClose={() => setDecision(null)} onSaved={reload} />
      <Modal open={Boolean(commentOf)} onClose={() => setCommentOf(null)} title={commentOf?.title}>
        {commentOf && <AiText text={commentOf.aiComment} />}
      </Modal>
    </>
  );
}
