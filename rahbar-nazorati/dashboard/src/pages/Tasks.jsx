import React, { useMemo, useState } from 'react';
import { Paperclip, Plus, Star, RotateCcw, BellRing } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { api } from '../api.js';
import { PageHead, AiBlock, Loading, useAsync, Pill, Modal, Empty, ChartTooltip, useThemeVersion, Stars, StarValue, toast } from '../components/ui.jsx';
import { STATUS, PRIORITY, REASONS, KPI_LEVELS, formatDate, formatDateTime, num, chartColors } from '../utils.js';
import { useViewer } from '../viewer.js';

function KpiPicker({ value, onChange }) {
  return (
    <div className="seg">
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} className={value === n ? 'active' : ''} onClick={() => onChange(n)} title={KPI_LEVELS[n]}>
          {n}
        </button>
      ))}
    </div>
  );
}

function tomorrowAt18() {
  const d = new Date(Date.now() + 86400000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:00`;
}

const PRIORITY_KPI = { PAST: 2, ORTA: 3, YUQORI: 4 };

function NewTaskModal({ open, onClose, onCreated }) {
  const { data } = useAsync(() => (open ? api.assignees() : Promise.resolve(null)), [open]);
  const empty = { assigneeId: '', title: '', description: '', deadline: tomorrowAt18(), priority: 'ORTA', kpiWeight: 3 };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setPriority = (priority) => setForm((f) => ({ ...f, priority, kpiWeight: PRIORITY_KPI[priority] }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createTask({ ...form, assigneeId: Number(form.assigneeId), deadline: new Date(form.deadline).toISOString() });
      toast('Vazifa yuborildi — ijrochi Telegram orqali xabar oldi');
      setForm(empty);
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Yangi vazifa">
      <form onSubmit={submit}>
        {error && <div className="alert">{error}</div>}
        <label className="field">
          <span>Ijrochi</span>
          <select className="input" value={form.assigneeId} onChange={set('assigneeId')} required>
            <option value="">Tanlang</option>
            {data?.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}{e.position ? ` — ${e.position}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Sarlavha</span>
          <input className="input" value={form.title} onChange={set('title')} maxLength={200} required placeholder="Masalan: Oylik sklad hisobotini topshirish" />
        </label>
        <label className="field">
          <span>Tavsif (ixtiyoriy)</span>
          <textarea className="input" rows={3} value={form.description} onChange={set('description')} placeholder="Nima qilish kerak, natija qanday bo'lishi kerak" />
        </label>
        <label className="field">
          <span>Deadline</span>
          <input className="input" type="datetime-local" value={form.deadline} onChange={set('deadline')} required />
        </label>
        <div className="field">
          <span>Muhimlik</span>
          <div className="seg">
            {Object.entries(PRIORITY).map(([k, v]) => (
              <button type="button" key={k} className={form.priority === k ? 'active' : ''} onClick={() => setPriority(k)}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>KPI og'irligi: <b>{form.kpiWeight}/5</b> · {KPI_LEVELS[form.kpiWeight]}</span>
          <KpiPicker value={form.kpiWeight} onChange={(kpiWeight) => setForm((f) => ({ ...f, kpiWeight }))} />
          <div className="small muted" style={{ marginTop: 6 }}>Og'irligi yuqori vazifa xodimning faollik baliga ko'proq ta'sir qiladi.</div>
        </div>
        <button className="btn" style={{ width: '100%', padding: 12, marginTop: 8 }} disabled={busy || !form.assigneeId || !form.title.trim()}>
          {busy ? 'Yuborilmoqda...' : 'Vazifani yuborish'}
        </button>
      </form>
    </Modal>
  );
}

function TaskActions({ task, permissions, onDone }) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (data, message) => {
    setBusy(true);
    try {
      await api.taskAction(task.id, data);
      toast(message);
      setMode(null);
      setComment('');
      onDone();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!permissions?.canRate && !permissions?.canRemind) return null;
  return (
    <div className="card" style={{ marginBottom: 14, padding: 14 }}>
      {permissions.canRate && (
        <>
          <div className="bold" style={{ marginBottom: 8 }}>Natijani baholang</div>
          <div className="row wrap" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 2 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className="icon-btn" onClick={() => setScore(n)} aria-label={`${n} yulduz`}>
                  <Star size={24} strokeWidth={1.5} color="#f5a623" fill={n <= score ? '#f5a623' : 'none'} />
                </button>
              ))}
            </div>
            <button className="btn sm" disabled={busy || !score} onClick={() => run({ action: 'rate', score }, 'Baho qo\'yildi')}>
              Baholash
            </button>
            <button className="btn ghost sm" disabled={busy} onClick={() => setMode(mode === 'return' ? null : 'return')}>
              <RotateCcw size={15} strokeWidth={1.75} /> Qayta ishlashga
            </button>
          </div>
          {mode === 'return' && (
            <div style={{ marginTop: 10 }}>
              <textarea className="input" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Nimani tuzatish kerak?" />
              <button className="btn sm" style={{ marginTop: 8 }} disabled={busy || !comment.trim()} onClick={() => run({ action: 'return', comment }, 'Vazifa qayta ishlashga qaytarildi')}>
                Qaytarish
              </button>
            </div>
          )}
        </>
      )}
      {permissions.canRemind && (
        <button className="btn ghost sm" disabled={busy} onClick={() => run({ action: 'remind' }, 'Eslatma Telegram orqali yuborildi')}>
          <BellRing size={15} strokeWidth={1.75} /> Eslatma yuborish
        </button>
      )}
    </div>
  );
}

function TaskModal({ id, onClose, onChanged }) {
  const { data, loading, reload } = useAsync(() => (id ? api.task(id) : Promise.resolve(null)), [id]);
  if (!id) return null;
  const t = data?.task;
  return (
    <Modal open onClose={onClose} title={t ? t.title : 'Vazifa'}>
      {loading || !t ? (
        <Loading />
      ) : (
        <>
          <TaskActions task={t} permissions={data.permissions} onDone={() => { reload(); onChanged(); }} />
          {t.description && <p style={{ whiteSpace: 'pre-wrap', marginTop: 0 }}>{t.description}</p>}
          <table>
            <tbody>
              <tr><td className="muted">Beruvchi</td><td>{t.assigner.fullName}</td></tr>
              <tr><td className="muted">Ijrochi</td><td>{t.assignee.fullName}</td></tr>
              <tr><td className="muted">Deadline</td><td>{formatDateTime(t.deadline)}</td></tr>
              <tr><td className="muted">KPI og'irligi</td><td>{t.kpiWeight}/5 · {KPI_LEVELS[t.kpiWeight]}</td></tr>
              <tr><td className="muted">Holat</td><td><Pill tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Pill> {t.progress}%</td></tr>
              <tr><td className="muted">Qabul qilingan</td><td>{formatDateTime(t.acceptedAt)}</td></tr>
              <tr><td className="muted">Bajarilgan</td><td>{formatDateTime(t.completedAt)}</td></tr>
              <tr><td className="muted">Sifat bahosi</td><td><Stars count={t.qualityScore} /></td></tr>
              <tr><td className="muted">Qaytarilgan</td><td>{t.returnCount} marta</td></tr>
              {t.failReason && <tr><td className="muted">Sabab</td><td>{REASONS[t.failReason]}{t.failReasonText ? ` — ${t.failReasonText}` : ''}</td></tr>}
            </tbody>
          </table>
          {t.files.length > 0 && (
            <>
              <div className="section-title" style={{ fontSize: 16 }}>Fayllar</div>
              {t.files.map((f) => (
                <div key={f.id} className="small row" style={{ gap: 6 }}><Paperclip size={14} strokeWidth={1.75} /> {f.fileName} — {f.uploader.fullName}, {formatDateTime(f.uploadedAt)} {f.isLate && <Pill tone="red">kechikib</Pill>}</div>
              ))}
            </>
          )}
          <div className="section-title" style={{ fontSize: 16 }}>Holat tarixi</div>
          {t.history.map((h) => (
            <div key={h.id} className="small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <b>{STATUS[h.newStatus]?.label}</b> {h.comment && `— ${h.comment}`}
              <div className="muted">{h.employee?.fullName || 'Tizim'} · {formatDateTime(h.createdAt)}</div>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

export default function Tasks() {
  useThemeVersion();
  const viewer = useViewer();
  const [filters, setFilters] = useState({ employeeId: '', department: '', status: '', from: '', to: '' });
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const { data, error, loading, reload } = useAsync(() => api.tasks(filters), [JSON.stringify(filters)]);
  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const c = chartColors();
  const palette = [c.s1, c.s2, c.s3, c.s4, c.s5];

  const reasonData = useMemo(
    () => (data?.reasons || []).map((r) => ({ name: REASONS[r.key], value: r.count, key: r.key })).sort((a, b) => b.value - a.value),
    [data],
  );
  const reasonTotal = reasonData.reduce((s, r) => s + r.value, 0);

  return (
    <>
      <PageHead title="Vazifalar" sub={viewer.isDirector ? 'Barcha vazifalar, holatlar va bajarilmaslik sabablari' : 'Jamoangiz vazifalari, holatlar va sabablar'}>
        {viewer.employeeId && (
          <button className="btn" onClick={() => setCreating(true)}>
            <Plus size={17} strokeWidth={2} /> Yangi vazifa
          </button>
        )}
      </PageHead>
      <div className="filters">
        <select className="input" value={filters.employeeId} onChange={set('employeeId')}>
          <option value="">Barcha xodimlar</option>
          {data?.filters.employees.map((e) => (
            <option key={e.id} value={e.id}>{e.fullName}</option>
          ))}
        </select>
        <select className="input" value={filters.department} onChange={set('department')}>
          <option value="">Barcha bo'limlar</option>
          {data?.filters.departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select className="input" value={filters.status} onChange={set('status')}>
          <option value="">Barcha holatlar</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <input className="input" type="date" value={filters.from} onChange={set('from')} title="Boshlanish sanasi" />
        <input className="input" type="date" value={filters.to} onChange={set('to')} title="Tugash sanasi" />
        {Object.values(filters).some(Boolean) && (
          <button className="btn ghost sm" onClick={() => setFilters({ employeeId: '', department: '', status: '', from: '', to: '' })}>
            Tozalash
          </button>
        )}
      </div>
      {error && <div className="alert">{error}</div>}
      {loading && !data ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="grid grid-2">
              <div className="card">
                <div className="card-title">Bajarilmaslik va kechikish sabablari</div>
                <div className="card-sub">Tanlangan vazifalar bo'yicha · {reasonTotal} ta holat</div>
                {reasonData.length ? (
                  <div className="row wrap" style={{ gap: 20 }}>
                    <div style={{ width: 200, height: 200 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={reasonData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2} stroke={c.surface} strokeWidth={2}>
                            {reasonData.map((r, i) => (
                              <Cell key={r.key} fill={palette[i % palette.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip formatter={(v) => `${v} ta (${Math.round((v / reasonTotal) * 100)}%)`} labelFormatter={() => 'Sabab'} />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grow">
                      {reasonData.map((r, i) => (
                        <div key={r.key} className="row between" style={{ padding: '6px 0' }}>
                          <span className="row" style={{ gap: 8 }}>
                            <i className="dot" style={{ background: palette[i % palette.length], borderRadius: 3 }} />
                            {r.name}
                          </span>
                          <b>
                            {r.value} <span className="muted small">({Math.round((r.value / reasonTotal) * 100)}%)</span>
                          </b>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Empty>Sabablar qayd etilmagan</Empty>
                )}
              </div>
              <div className="card">
                <div className="card-title">Holatlar bo'yicha</div>
                <div className="card-sub">Jami: {data.tasks.length} ta vazifa</div>
                {Object.entries(STATUS).map(([k, v]) => {
                  const count = data.byStatus[k] || 0;
                  const share = data.tasks.length ? (count / data.tasks.length) * 100 : 0;
                  return (
                    <div key={k} style={{ padding: '5px 0' }}>
                      <div className="row between small">
                        <span>{v.label}</span>
                        <b>{count}</b>
                      </div>
                      <div className="bar-track">
                        <div style={{ width: `${share}%`, background: `var(--${v.tone})` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <AiBlock module="VAZIFALAR" title="AI tahlil: vazifalar ijrosi" compact />
            </div>

            <div className="section-title">Vazifalar ro'yxati</div>
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Vazifa</th>
                      <th>Ijrochi</th>
                      <th>Beruvchi</th>
                      <th>Deadline</th>
                      <th>Holat</th>
                      <th>Muhimlik</th>
                      <th className="num">KPI</th>
                      <th className="num">Kechikish</th>
                      <th className="num">Baho</th>
                      <th>Sabab</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tasks.map((t) => {
                      const s = t.isOverdue ? STATUS.MUDDATI_OTGAN : STATUS[t.status];
                      return (
                        <tr key={t.id} className="clickable" onClick={() => setOpenId(t.id)}>
                          <td style={{ minWidth: 220 }}>
                            <b>{t.title}</b>
                            {t.filesCount > 0 && <span className="muted small" style={{ marginLeft: 6, whiteSpace: 'nowrap' }}><Paperclip size={12} strokeWidth={1.75} style={{ verticalAlign: -1 }} />{t.filesCount}</span>}
                          </td>
                          <td>
                            {t.assignee.fullName}
                            <div className="small muted">{t.assignee.department}</div>
                          </td>
                          <td className="small">{t.assigner.fullName}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{formatDate(t.deadline)}</td>
                          <td><Pill tone={s.tone}>{s.label}</Pill></td>
                          <td><Pill tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Pill></td>
                          <td className="num" title={KPI_LEVELS[t.kpiWeight]}>{t.kpiWeight}/5</td>
                          <td className={`num ${t.delayDays > 0 ? 'neg' : ''}`}>{t.delayDays > 0 ? `${num(t.delayDays)} kun` : '—'}</td>
                          <td className="num"><StarValue value={t.qualityScore} /></td>
                          <td className="small">{t.failReason ? REASONS[t.failReason] : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!data.tasks.length && <Empty>Filtrga mos vazifa topilmadi</Empty>}
              </div>
            </div>
          </>
        )
      )}
      <TaskModal id={openId} onClose={() => setOpenId(null)} onChanged={reload} />
      <NewTaskModal open={creating} onClose={() => setCreating(false)} onCreated={reload} />
    </>
  );
}
