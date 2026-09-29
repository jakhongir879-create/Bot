import React, { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { api } from '../api.js';
import { PageHead, AiBlock, Loading, useAsync, Pill, Modal, ChartTooltip, Legend, ScoreBadge, Empty, useThemeVersion } from '../components/ui.jsx';
import { ROLES, STATUS, num, pct, formatDate, chartColors } from '../utils.js';

function TrendIcon({ trend }) {
  if (!trend || trend.delta === null) return <span className="muted">—</span>;
  if (trend.delta > 0) return <span className="tone-green bold">↑ {trend.delta}</span>;
  if (trend.delta < 0) return <span className="tone-red bold">↓ {Math.abs(trend.delta)}</span>;
  return <span className="muted">→ 0</span>;
}

function EmployeeModal({ id, onClose }) {
  const { data, loading } = useAsync(() => (id ? api.employeeActivity(id) : Promise.resolve(null)), [id]);
  if (!id) return null;
  const c = chartColors();
  return (
    <Modal open onClose={onClose} wide title={data ? data.employee.fullName : 'Xodim'}>
      {loading || !data ? (
        <Loading />
      ) : (
        <>
          <div className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
            {data.employee.position} · {data.employee.department} · {ROLES[data.employee.role]}
          </div>
          <div className="grid grid-kpi">
            <div className="card" style={{ background: 'var(--card-2)' }}>
              <div className="kpi-label">Faollik bali (90 kun)</div>
              <div className="kpi-value"><ScoreBadge score={data.metrics.score} /></div>
            </div>
            <div className="card" style={{ background: 'var(--card-2)' }}>
              <div className="kpi-label">Muddatida bajarish</div>
              <div className="kpi-value">{pct(data.metrics.onTimeRate)}</div>
            </div>
            <div className="card" style={{ background: 'var(--card-2)' }}>
              <div className="kpi-label">O'rtacha sifat</div>
              <div className="kpi-value">{num(data.metrics.avgQuality)} ⭐</div>
            </div>
            <div className="card" style={{ background: 'var(--card-2)' }}>
              <div className="kpi-label">Qabul qilish tezligi</div>
              <div className="kpi-value">{num(data.metrics.avgAcceptHours)} soat</div>
            </div>
          </div>
          <div className="section-title" style={{ fontSize: 16 }}>Haftalik trend</div>
          <div className="chart sm">
            <ResponsiveContainer>
              <LineChart data={data.weekly} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <ReferenceLine y={75} stroke={c.grid} strokeDasharray="4 4" />
                <XAxis dataKey="week" tickFormatter={(w) => w.slice(0, 5)} tick={{ fontSize: 12, fill: c.axis }} tickLine={false} axisLine={{ stroke: c.baseline }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: c.axis }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip labelFormatter={(w) => `${w} haftasi`} />} />
                <Line dataKey="score" name="Ball" stroke={c.s1} strokeWidth={2} dot={{ r: 4, fill: c.s1, stroke: c.surface, strokeWidth: 2 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="section-title" style={{ fontSize: 16 }}>Oxirgi vazifalar</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Vazifa</th><th>Deadline</th><th>Holat</th><th className="num">Baho</th></tr>
              </thead>
              <tbody>
                {data.tasks.slice(0, 20).map((t) => (
                  <tr key={t.id}>
                    <td>{t.title}</td>
                    <td>{formatDate(t.deadline)}</td>
                    <td><Pill tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Pill></td>
                    <td className="num">{t.qualityScore ? `${t.qualityScore} ⭐` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function Activity() {
  useThemeVersion();
  const [days, setDays] = useState(30);
  const [openId, setOpenId] = useState(null);
  const { data, error, loading } = useAsync(() => api.activity(days), [days]);
  const c = chartColors();

  return (
    <>
      <PageHead title="Xodimlar faolligi" sub="Faollik bali: muddatida bajarish 30% · qabul tezligi 20% · bajarish tezligi 20% · sifat 20% · qaytarilganlar 10%">
        <div className="segmented">
          {[7, 30, 90].map((d) => (
            <button key={d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>
              {d} kun
            </button>
          ))}
        </div>
      </PageHead>
      {error && <div className="alert">{error}</div>}
      {loading && !data ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="card">
              <div className="card-title">Reyting</div>
              <div className="card-sub">Batafsil ko'rish uchun xodimni bosing</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th className="num">#</th>
                      <th>Xodim</th>
                      <th>Ball / holat</th>
                      <th className="num">Muddatida</th>
                      <th className="num">O'rt. kechikish</th>
                      <th className="num">Qabul tezligi</th>
                      <th className="num">Sifat</th>
                      <th className="num">Qaytarilgan</th>
                      <th className="num">Vazifalar</th>
                      <th className="num">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ranking.map((r) => (
                      <tr key={r.id} className="clickable" onClick={() => setOpenId(r.id)}>
                        <td className="num muted">{r.rank}</td>
                        <td style={{ minWidth: 190 }}>
                          <b>{r.fullName}</b>
                          <div className="small muted">
                            {ROLES[r.role]} · {r.department}
                          </div>
                        </td>
                        <td><ScoreBadge score={r.score} /></td>
                        <td className="num">{pct(r.onTimeRate, 0)}</td>
                        <td className={`num ${r.avgDelayDays > 1 ? 'neg' : ''}`}>{r.avgDelayDays ? `${num(r.avgDelayDays)} kun` : '—'}</td>
                        <td className="num">{r.avgAcceptHours === null ? '—' : `${num(r.avgAcceptHours)} soat`}</td>
                        <td className="num">{r.avgQuality === null ? '—' : `${num(r.avgQuality)} ⭐`}</td>
                        <td className="num">{r.returns}</td>
                        <td className="num">
                          {r.total}
                          {r.overdue > 0 && <span className="tone-red small"> ({r.overdue} o'tgan)</span>}
                        </td>
                        <td className="num"><TrendIcon trend={r.trend} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.ranking.length && <Empty />}
              </div>
            </div>

            <div className="grid grid-2" style={{ marginTop: 16 }}>
              <div className="card">
                <div className="card-title">Top va middle management solishtirish</div>
                <div className="card-sub">Tanlangan davr bo'yicha o'rtacha ko'rsatkichlar</div>
                <table>
                  <thead>
                    <tr><th>Ko'rsatkich</th>{data.comparison.map((g) => <th key={g.role} className="num">{ROLES[g.role]}</th>)}</tr>
                  </thead>
                  <tbody>
                    <tr><td>Xodimlar soni</td>{data.comparison.map((g) => <td key={g.role} className="num">{g.count}</td>)}</tr>
                    <tr><td>O'rtacha ball</td>{data.comparison.map((g) => <td key={g.role} className="num bold">{num(g.avgScore)}</td>)}</tr>
                    <tr><td>Muddatida bajarish</td>{data.comparison.map((g) => <td key={g.role} className="num">{pct(g.avgOnTime)}</td>)}</tr>
                    <tr><td>O'rtacha sifat</td>{data.comparison.map((g) => <td key={g.role} className="num">{num(g.avgQuality)} ⭐</td>)}</tr>
                    <tr><td>Qabul qilish (soat)</td>{data.comparison.map((g) => <td key={g.role} className="num">{num(g.avgAcceptHours)}</td>)}</tr>
                    <tr><td>Muddati o'tgan</td>{data.comparison.map((g) => <td key={g.role} className="num">{g.overdue}</td>)}</tr>
                    <tr><td>Qaytarilganlar</td>{data.comparison.map((g) => <td key={g.role} className="num">{g.returns}</td>)}</tr>
                  </tbody>
                </table>
              </div>
              <div className="card">
                <div className="card-title">Haftalik trend</div>
                <div className="card-sub">O'rtacha faollik bali, oxirgi 8 hafta</div>
                <Legend items={[{ label: 'Umumiy', color: c.s1, line: true }, { label: 'Top management', color: c.s2, line: true }, { label: 'Middle management', color: c.s3, line: true }]} />
                <div className="chart sm">
                  <ResponsiveContainer>
                    <LineChart data={data.weekly} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={c.grid} />
                      <ReferenceLine y={75} stroke={c.grid} strokeDasharray="4 4" />
                      <XAxis dataKey="week" tickFormatter={(w) => w.slice(0, 5)} tick={{ fontSize: 12, fill: c.axis }} tickLine={false} axisLine={{ stroke: c.baseline }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: c.axis }} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip labelFormatter={(w) => `${w} haftasi`} />} />
                      <Line dataKey="umumiy" name="Umumiy" stroke={c.s1} strokeWidth={2} dot={{ r: 4, fill: c.s1, stroke: c.surface, strokeWidth: 2 }} connectNulls />
                      <Line dataKey="top" name="Top" stroke={c.s2} strokeWidth={2} dot={{ r: 4, fill: c.s2, stroke: c.surface, strokeWidth: 2 }} connectNulls />
                      <Line dataKey="middle" name="Middle" stroke={c.s3} strokeWidth={2} dot={{ r: 4, fill: c.s3, stroke: c.surface, strokeWidth: 2 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <AiBlock module="FAOLLIK" title="🤖 AI tahlil: xodimlar faolligi" compact />
            </div>
          </>
        )
      )}
      <EmployeeModal id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
