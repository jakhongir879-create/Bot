import React from 'react';
import { Sparkles, Trophy, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { api } from '../api.js';
import { Kpi, PageHead, AiBlock, Loading, useAsync, ChartTooltip, Legend, ScoreBadge, Pill, useThemeVersion, StatusDot } from '../components/ui.jsx';
import { money, compactMoney, pct, num, monthLabel, formatDate, chartColors, GOAL_STATUS, scoreTone } from '../utils.js';

export default function Overview() {
  useThemeVersion();
  const { data, error, loading } = useAsync(() => api.overview(), []);
  if (loading) return <Loading />;
  if (error) return <div className="alert">{error}</div>;
  const c = chartColors();
  const { tasks, avgScore, lastStockCheck, finance, statusCounts, topEmployees, weakEmployees } = data;
  const cur = finance?.current;
  const team = Boolean(data.team);

  return (
    <>
      <PageHead title="Bosh sahifa" sub={team ? "Jamoangiz ko'rsatkichlari · oxirgi 30 kun" : "Kompaniyaning asosiy ko'rsatkichlari · oxirgi 30 kun"} />
      <div className="grid grid-kpi">
        <Kpi label="Vazifalar bajarilishi" value={pct(tasks.completionRate)} foot={`Muddatida: ${pct(tasks.onTimeRate)} · ${tasks.total} ta vazifa`} tone={tasks.completionRate >= 80 ? 'green' : tasks.completionRate >= 60 ? 'yellow' : 'red'} />
        <Kpi label="Muddati o'tganlar" value={tasks.overdueNow} foot="Hozirgi holat bo'yicha" tone={tasks.overdueNow ? 'red' : 'green'} />
        <Kpi label="O'rtacha faollik bali" value={num(avgScore, 0)} foot={<span className="row" style={{ gap: 10 }}><span className="row" style={{ gap: 5 }}><StatusDot tone="green" />{statusCounts.faol}</span><span className="row" style={{ gap: 5 }}><StatusDot tone="yellow" />{statusCounts.ortacha}</span><span className="row" style={{ gap: 5 }}><StatusDot tone="red" />{statusCounts.sust}</span></span>} tone={scoreTone(avgScore)} />
        {!team && (<>
        <Kpi
          label="Oxirgi sverka farqi"
          value={lastStockCheck ? compactMoney(lastStockCheck.totalDiff) : '—'}
          foot={lastStockCheck ? `${formatDate(lastStockCheck.checkDate)} · ${lastStockCheck.warehouse}` : "Sverka o'tkazilmagan"}
          tone={lastStockCheck && lastStockCheck.totalDiff < 0 ? 'red' : undefined}
        />
        <Kpi label={`Tushum (${cur ? monthLabel(cur.month) : '—'})`} value={cur ? compactMoney(cur.revenue) : '—'} foot={cur ? `Reja bajarilishi: ${pct(cur.planExecution)}` : "Moliyaviy ma'lumot yo'q"} tone={cur && cur.planExecution >= 100 ? 'green' : undefined} />
        <Kpi label="Sof foyda marjasi" value={cur ? pct(cur.netMargin) : '—'} foot={cur ? `Sof foyda: ${money(cur.netProfit)}` : ''} tone={cur && cur.netMargin < 0 ? 'red' : undefined} />
        </>)}
      </div>

      {!team && (<>
      <div className="section-title row" style={{ gap: 8 }}><Sparkles size={20} strokeWidth={1.75} color="#5e5ce6" />AI umumiy xulosa</div>
      <AiBlock module="UMUMIY" title="AI umumiy xulosa" />

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-title">Tushum: reja va fakt</div>
          <div className="card-sub">Oxirgi 6 oy</div>
          <Legend items={[{ label: 'Fakt', color: c.s1 }, { label: 'Reja', color: c.s2, line: true }]} />
          <div className="chart sm">
            <ResponsiveContainer>
              <ComposedChart data={finance.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, true)} tick={{ fontSize: 12, fill: c.axis }} tickLine={false} axisLine={{ stroke: c.baseline }} />
                <YAxis tickFormatter={compactMoney} tick={{ fontSize: 12, fill: c.axis }} tickLine={false} axisLine={false} width={84} />
                <Tooltip content={<ChartTooltip formatter={money} labelFormatter={(m) => monthLabel(m)} />} cursor={{ fill: c.grid, opacity: 0.4 }} />
                <Bar dataKey="revenue" name="Fakt" fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Line dataKey="revenuePlan" name="Reja" stroke={c.s2} strokeWidth={2} dot={{ r: 4, fill: c.s2, stroke: c.surface, strokeWidth: 2 }} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Strategik maqsadlar</div>
          <div className="card-sub">Oxirgi 3 oy fakti bo'yicha</div>
          {finance.goals.length ? (
            finance.goals.map((g) => {
              const s = GOAL_STATUS[g.status];
              return (
                <div key={g.name} className="row between" style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                  <span className="grow">{g.name}</span>
                  <Pill tone={s.tone}>
                    {s.icon} {s.label}
                  </Pill>
                </div>
              );
            })
          ) : (
            <div className="muted">Maqsadlar kiritilmagan</div>
          )}
        </div>
      </div>
      </>)}

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-title row" style={{ gap: 8 }}><Trophy size={17} strokeWidth={1.75} color="#eda100" />Eng faol xodimlar</div>
          {topEmployees.map((e) => (
            <div key={e.id} className="row between" style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="grow">
                <div className="bold">{e.fullName}</div>
                <div className="small muted">{e.position}</div>
              </div>
              <ScoreBadge score={e.score} />
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title row" style={{ gap: 8 }}><AlertTriangle size={17} strokeWidth={1.75} color="#d03b3b" />E'tibor talab qiladi</div>
          {weakEmployees.map((e) => (
            <div key={e.id} className="row between" style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="grow">
                <div className="bold">{e.fullName}</div>
                <div className="small muted">
                  {e.position} · muddati o'tgan: {e.overdue}
                </div>
              </div>
              <ScoreBadge score={e.score} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
