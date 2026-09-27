import { useEffect, useState } from 'react';
import { api, downloadExcel, periodQuery } from '../api';
import { Delta, Empty, PeriodPicker } from '../components/ui';
import { money, num } from '../utils';

export default function Reports() {
  const [period, setPeriod] = useState({ period: 'month' });
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/reports/overview?${periodQuery(period)}`).then(setData);
  }, [period]);

  const excel = async () => {
    setBusy(true);
    try {
      await downloadExcel(period);
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="loading">Yuklanmoqda...</div>;
  const s = data.summary;
  const p = data.prevSummary;

  const pl = [
    ['Sotuvdan tushum (chegirmadan keyin)', s.revenue, p.revenue, data.changes.revenue],
    ['Berilgan chegirmalar', s.discount, p.discount, data.changes.discount, true],
    ['Mahsulot tannarxi', s.costTotal, p.costTotal, data.changes.costTotal, true],
    ['Yalpi foyda', s.grossProfit, p.grossProfit, data.changes.grossProfit, false, true],
    ...data.expensesByCategory.map((e) => [`   − ${e.category}`, e.amount, null, undefined, true]),
    ['Jami xarajatlar', s.expenses, p.expenses, data.changes.expenses, true],
    ['SOF FOYDA', s.netProfit, p.netProfit, data.changes.netProfit, false, true],
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hisobotlar</h1>
          <p>{data.range.label}</p>
        </div>
        <button className="btn primary" onClick={excel} disabled={busy}>
          📥 {busy ? 'Tayyorlanmoqda...' : 'Excel yuklab olish'}
        </button>
      </div>

      <div className="card">
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      <div className="grid two mt">
        <div className="card">
          <div className="card-head">
            <h2>Foyda va zarar hisoboti</h2>
            <span className="muted small">oldingi davrga nisbatan</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ko'rsatkich</th>
                  <th className="num">Joriy davr</th>
                  <th className="num hide-sm">Oldingi davr</th>
                  <th className="num">O'zgarish</th>
                </tr>
              </thead>
              <tbody>
                {pl.map(([label, cur, prev, ch, inverse, bold]) => (
                  <tr key={label} style={bold ? { background: 'var(--page)' } : undefined}>
                    <td style={{ fontWeight: bold ? 700 : 400, whiteSpace: 'pre' }}>{label}</td>
                    <td className="num" style={{ fontWeight: bold ? 700 : 400 }}>{money(cur)}</td>
                    <td className="num muted hide-sm">{prev === null ? '' : money(prev)}</td>
                    <td className="num">{ch !== undefined && <Delta value={ch} inverse={inverse} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Asosiy ko'rsatkichlar</h2></div>
          {[
            ['Sotuvlar soni', `${s.salesCount} ta`],
            ["O'rtacha chek", money(s.avgCheck)],
            ['Sotilgan mahsulotlar', `${num(s.itemsSold)} ta`],
            ['Marja', `${s.margin}%`],
            ['Naqd tushgan pul', money(s.paid)],
            ['Yangi nasiya', money(s.newDebt)],
            ['Xarid qilgan mijozlar', `${s.customers} ta`],
            ['Kunlik o\'rtacha tushum', money(s.revenue / data.range.days)],
          ].map(([k, v]) => (
            <div className="list-row" key={k}>
              <span className="muted">{k}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="grid half mt">
        <div className="card">
          <div className="card-head"><h2>Mahsulotlar bo'yicha</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mahsulot</th>
                  <th className="num">Soni</th>
                  <th className="num">Tushum</th>
                  <th className="num">Foyda</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((t) => (
                  <tr key={t.name}>
                    <td>{t.name}</td>
                    <td className="num">{num(t.quantity)}</td>
                    <td className="num">{money(t.revenue)}</td>
                    <td className="num">{money(t.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.topProducts.length && <Empty />}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Kunlar bo'yicha</h2></div>
          <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Sana</th>
                  <th className="num">Sotuv</th>
                  <th className="num">Tushum</th>
                  <th className="num">Sof foyda</th>
                </tr>
              </thead>
              <tbody>
                {[...data.series].reverse().map((d) => (
                  <tr key={d.date}>
                    <td>{d.date.split('-').reverse().join('.')}</td>
                    <td className="num">{d.salesCount}</td>
                    <td className="num">{money(d.revenue)}</td>
                    <td className="num" style={{ color: d.netProfit < 0 ? 'var(--bad)' : undefined }}>{money(d.netProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
