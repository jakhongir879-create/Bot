import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, periodQuery } from '../api';
import { Delta, Empty, PeriodPicker } from '../components/ui';
import { PAYMENT, dateTime, dayLabel, money, num, short } from '../utils';

const SERIES = [
  { key: 'revenue', label: 'Tushum', color: 'var(--s1)' },
  { key: 'expenses', label: 'Xarajat', color: 'var(--s2)' },
  { key: 'netProfit', label: 'Sof foyda', color: 'var(--s3)' },
];

const axis = { stroke: 'var(--muted)', fontSize: 12, tickLine: false, axisLine: { stroke: 'var(--grid)' } };

function ChartTooltip({ active, payload, label, labelFormat }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip">
      <div className="t">{labelFormat ? labelFormat(label) : label}</div>
      {payload.map((p) => (
        <div className="r" key={p.dataKey}>
          <span>
            <i style={{ background: p.color }} />
            {p.name}
          </span>
          <b>{money(p.value)}</b>
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value, delta, inverse, sub }) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div>
        {delta !== undefined && <Delta value={delta} inverse={inverse} />}
        {sub && <span className="kpi sub small">{sub}</span>}
      </div>
    </div>
  );
}

function BarList({ items, color = 'var(--s1)', format = money }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (!items.length) return <Empty />;
  return (
    <div className="bar-list">
      {items.map((i) => (
        <div className="item" key={i.label}>
          <div className="top">
            <span>{i.label}</span>
            <b>{format(i.value)}</b>
          </div>
          <div className="track">
            <div className="fill" style={{ width: `${(i.value / max) * 100}%`, background: color }} />
          </div>
          {i.note && <div className="muted small" style={{ marginTop: 3 }}>{i.note}</div>}
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [period, setPeriod] = useState({ period: 'week' });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .get(`/reports/overview?${periodQuery(period)}`)
        .then((d) => alive && (setData(d), setError('')))
        .catch((e) => alive && setError(e.message));
    load();
    const t = setInterval(load, 30000); // har 30 soniyada yangilanadi
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [period]);

  if (error) return <div className="alert">{error}</div>;
  if (!data) return <div className="loading">Yuklanmoqda...</div>;

  const { summary: s, changes: c } = data;
  const singleDay = data.range.days === 1;
  const hourly = data.hourly.filter((h) => h.hour >= 7 || h.revenue > 0);
  const payTotal = data.byPayment.reduce((a, b) => a + b.amount, 0) || 1;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Bosh sahifa</h1>
          <p>{data.range.label} • avtomatik yangilanadi</p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      <div className="grid kpis">
        <Kpi label="💰 Tushum" value={money(s.revenue)} delta={c.revenue} />
        <Kpi label="✅ Sof foyda" value={money(s.netProfit)} delta={c.netProfit} />
        <Kpi label="📈 Yalpi foyda" value={money(s.grossProfit)} delta={c.grossProfit} sub={`marja ${s.margin}%`} />
        <Kpi label="💸 Xarajatlar" value={money(s.expenses)} delta={c.expenses} inverse />
        <Kpi label="🧾 Sotuvlar soni" value={`${s.salesCount} ta`} delta={c.salesCount} />
        <Kpi label="🛒 O'rtacha chek" value={money(s.avgCheck)} delta={c.avgCheck} />
        <Kpi label="💳 Umumiy qarzdorlik" value={money(data.debtTotal)} sub={`bu davrda +${short(s.newDebt)}`} />
        <Kpi label="📦 Ombor qiymati" value={money(data.stockValue.cost)} sub={`${data.stockValue.count} mahsulot`} />
      </div>

      <div className="grid two mt">
        <div className="card">
          <div className="card-head">
            <h2>{singleDay ? 'Soatlar bo\'yicha tushum' : 'Tushum, xarajat va sof foyda'}</h2>
            {!singleDay && (
              <div className="legend">
                {SERIES.map((x) => (
                  <span key={x.key}>
                    <i style={{ background: x.color }} />
                    {x.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              {singleDay ? (
                <BarChart data={hourly} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--grid)" />
                  <XAxis dataKey="hour" {...axis} tickFormatter={(h) => `${h}:00`} />
                  <YAxis {...axis} axisLine={false} tickFormatter={short} width={72} />
                  <Tooltip
                    cursor={{ fill: 'var(--page)' }}
                    content={<ChartTooltip labelFormat={(h) => `${h}:00 — ${h + 1}:00`} />}
                  />
                  <Bar dataKey="revenue" name="Tushum" fill="var(--s1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              ) : (
                <LineChart data={data.series} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--grid)" />
                  <XAxis dataKey="date" {...axis} tickFormatter={dayLabel} minTickGap={16} />
                  <YAxis {...axis} axisLine={false} tickFormatter={short} width={72} />
                  <Tooltip
                    cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }}
                    content={<ChartTooltip labelFormat={(k) => k.split('-').reverse().join('.')} />}
                  />
                  {SERIES.map((x) => (
                    <Line
                      key={x.key}
                      dataKey={x.key}
                      name={x.label}
                      stroke={x.color}
                      strokeWidth={2}
                      dot={data.series.length <= 14 ? { r: 3, strokeWidth: 0, fill: x.color } : false}
                      activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                    />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>To'lov turlari</h2>
          </div>
          <BarList
            items={data.byPayment.map((p) => ({
              label: PAYMENT[p.method],
              value: p.amount,
              note: `${p.count} ta sotuv • ${Math.round((p.amount / payTotal) * 100)}%`,
            }))}
          />
        </div>
      </div>

      <div className="grid half mt">
        <div className="card">
          <div className="card-head">
            <h2>🏆 Top mahsulotlar</h2>
            <span className="muted small">tushum bo'yicha</span>
          </div>
          <BarList
            items={data.topProducts.slice(0, 7).map((p) => ({
              label: p.name,
              value: p.revenue,
              note: `${num(p.quantity)} ta sotildi • foyda ${money(p.profit)}`,
            }))}
          />
        </div>
        <div className="card">
          <div className="card-head">
            <h2>💸 Xarajatlar tarkibi</h2>
            <Link to="/expenses" className="small">Barchasi →</Link>
          </div>
          <BarList
            color="var(--s2)"
            items={data.expensesByCategory.map((e) => ({ label: e.category, value: e.amount }))}
          />
        </div>
      </div>

      {!singleDay && (
        <div className="card mt">
          <div className="card-head">
            <h2>🕐 Qaysi soatlarda ko'p sotiladi</h2>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={hourly} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="hour" {...axis} tickFormatter={(h) => `${h}`} />
                <YAxis {...axis} axisLine={false} tickFormatter={short} width={72} />
                <Tooltip
                  cursor={{ fill: 'var(--page)' }}
                  content={<ChartTooltip labelFormat={(h) => `${h}:00 — ${h + 1}:00`} />}
                />
                <Bar dataKey="revenue" name="Tushum" fill="var(--s1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid half mt">
        <div className="card">
          <div className="card-head">
            <h2>⚠️ Omborda kam qolgan</h2>
            <Link to="/products" className="small">Ombor →</Link>
          </div>
          {data.lowStock.length ? (
            data.lowStock.map((p) => (
              <div className="list-row" key={p.id}>
                <span>{p.name}</span>
                <span className="badge red">
                  {num(p.stock)} {p.unit}
                </span>
              </div>
            ))
          ) : (
            <Empty>Hammasi yetarli 👍</Empty>
          )}
        </div>
        <div className="card">
          <div className="card-head">
            <h2>💳 Eng katta qarzdorlar</h2>
            <Link to="/debts" className="small">Barchasi →</Link>
          </div>
          {data.topDebtors.length ? (
            data.topDebtors.map((c) => (
              <div className="list-row" key={c.id}>
                <span>
                  {c.name} <span className="muted small">{c.phone}</span>
                </span>
                <b>{money(c.debt)}</b>
              </div>
            ))
          ) : (
            <Empty>Qarzdorlar yo'q 👍</Empty>
          )}
        </div>
      </div>

      <div className="card mt">
        <div className="card-head">
          <h2>🧾 Oxirgi sotuvlar</h2>
          <Link to="/sales" className="small">Barchasi →</Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="hide-sm">№</th>
                <th>Sana</th>
                <th>Mahsulotlar</th>
                <th className="hide-sm">To'lov</th>
                <th className="num">Summa</th>
              </tr>
            </thead>
            <tbody>
              {data.recentSales.map((s) => (
                <tr key={s.id}>
                  <td className="muted hide-sm">{s.id}</td>
                  <td className="small">{dateTime(s.createdAt)}</td>
                  <td>{s.items.map((i) => `${i.productName} ×${num(i.quantity)}`).join(', ')}</td>
                  <td className="hide-sm">
                    <span className={`badge ${s.paymentMethod === 'DEBT' ? 'orange' : ''}`}>{PAYMENT[s.paymentMethod]}</span>
                  </td>
                  <td className="num">
                    <b>{money(s.total)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.recentSales.length && <Empty />}
        </div>
      </div>
    </>
  );
}
