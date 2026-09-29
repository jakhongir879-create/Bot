import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { api } from '../api.js';
import { PageHead, AiBlock, Loading, useAsync, Pill, Modal, Empty, ChartTooltip, useThemeVersion } from '../components/ui.jsx';
import { STATUS, PRIORITY, REASONS, formatDate, formatDateTime, num, chartColors } from '../utils.js';

function TaskModal({ id, onClose }) {
  const { data, loading } = useAsync(() => (id ? api.task(id) : Promise.resolve(null)), [id]);
  if (!id) return null;
  const t = data?.task;
  return (
    <Modal open onClose={onClose} title={t ? t.title : 'Vazifa'}>
      {loading || !t ? (
        <Loading />
      ) : (
        <>
          {t.description && <p style={{ whiteSpace: 'pre-wrap', marginTop: 0 }}>{t.description}</p>}
          <table>
            <tbody>
              <tr><td className="muted">Beruvchi</td><td>{t.assigner.fullName}</td></tr>
              <tr><td className="muted">Ijrochi</td><td>{t.assignee.fullName}</td></tr>
              <tr><td className="muted">Deadline</td><td>{formatDateTime(t.deadline)}</td></tr>
              <tr><td className="muted">Holat</td><td><Pill tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Pill> {t.progress}%</td></tr>
              <tr><td className="muted">Qabul qilingan</td><td>{formatDateTime(t.acceptedAt)}</td></tr>
              <tr><td className="muted">Bajarilgan</td><td>{formatDateTime(t.completedAt)}</td></tr>
              <tr><td className="muted">Sifat bahosi</td><td>{t.qualityScore ? '⭐'.repeat(t.qualityScore) : '—'}</td></tr>
              <tr><td className="muted">Qaytarilgan</td><td>{t.returnCount} marta</td></tr>
              {t.failReason && <tr><td className="muted">Sabab</td><td>{REASONS[t.failReason]}{t.failReasonText ? ` — ${t.failReasonText}` : ''}</td></tr>}
            </tbody>
          </table>
          {t.files.length > 0 && (
            <>
              <div className="section-title" style={{ fontSize: 16 }}>Fayllar</div>
              {t.files.map((f) => (
                <div key={f.id} className="small">📎 {f.fileName} — {f.uploader.fullName}, {formatDateTime(f.uploadedAt)} {f.isLate && <Pill tone="red">kechikib</Pill>}</div>
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
  const [filters, setFilters] = useState({ employeeId: '', department: '', status: '', from: '', to: '' });
  const [openId, setOpenId] = useState(null);
  const { data, error, loading } = useAsync(() => api.tasks(filters), [JSON.stringify(filters)]);
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
      <PageHead title="Vazifalar" sub="Barcha vazifalar, holatlar va bajarilmaslik sabablari" />
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
              <AiBlock module="VAZIFALAR" title="🤖 AI tahlil: vazifalar ijrosi" compact />
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
                            {t.filesCount > 0 && <span className="muted small"> 📎{t.filesCount}</span>}
                          </td>
                          <td>
                            {t.assignee.fullName}
                            <div className="small muted">{t.assignee.department}</div>
                          </td>
                          <td className="small">{t.assigner.fullName}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{formatDate(t.deadline)}</td>
                          <td><Pill tone={s.tone}>{s.label}</Pill></td>
                          <td><Pill tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Pill></td>
                          <td className={`num ${t.delayDays > 0 ? 'neg' : ''}`}>{t.delayDays > 0 ? `${num(t.delayDays)} kun` : '—'}</td>
                          <td className="num">{t.qualityScore ? `${t.qualityScore} ⭐` : '—'}</td>
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
      <TaskModal id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
