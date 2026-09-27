import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Empty, useToast } from '../components/ui';
import { dateTime, money, num } from '../utils';
import { PayModal } from './Sales';

export default function Debts() {
  const [sales, setSales] = useState([]);
  const [paying, setPaying] = useState(null);
  const [toast, showToast] = useToast();

  const load = useCallback(() => {
    api.get('/sales?debt=1&limit=500').then((r) => setSales(r.items));
  }, []);
  useEffect(load, [load]);

  const total = sales.reduce((s, x) => s + x.total - x.paidAmount, 0);
  const byCustomer = Object.values(
    sales.reduce((acc, s) => {
      const k = s.customer?.id || 0;
      acc[k] = acc[k] || { name: s.customer?.name || "Noma'lum", phone: s.customer?.phone, debt: 0, count: 0 };
      acc[k].debt += s.total - s.paidAmount;
      acc[k].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.debt - a.debt);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Qarzdorlik (nasiya)</h1>
          <p>Umumiy qarz: <b style={{ color: 'var(--bad)' }}>{money(total)}</b></p>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="card-head"><h2>To'lanmagan sotuvlar</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>№</th>
                  <th>Mijoz</th>
                  <th className="hide-sm">Sana</th>
                  <th className="num">Jami</th>
                  <th className="num">Qarz</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td className="muted">{s.id}</td>
                    <td>
                      <b>{s.customer?.name || '—'}</b>
                      <div className="muted small">{s.items.map((i) => `${i.productName} ×${num(i.quantity)}`).join(', ')}</div>
                    </td>
                    <td className="small hide-sm">{dateTime(s.createdAt)}</td>
                    <td className="num">{money(s.total)}</td>
                    <td className="num"><b style={{ color: 'var(--bad)' }}>{money(s.total - s.paidAmount)}</b></td>
                    <td className="num"><button className="btn sm" onClick={() => setPaying(s)}>To'lov</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!sales.length && <Empty>Qarzdorlik yo'q 👍</Empty>}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Mijozlar bo'yicha</h2></div>
          {byCustomer.map((c) => (
            <div className="list-row" key={c.name + c.phone}>
              <span>
                {c.name}
                <div className="muted small">{c.phone || ''} • {c.count} ta sotuv</div>
              </span>
              <b>{money(c.debt)}</b>
            </div>
          ))}
          {!byCustomer.length && <Empty />}
        </div>
      </div>

      {paying && (
        <PayModal
          sale={paying}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null);
            showToast("✅ To'lov qabul qilindi");
            load();
          }}
        />
      )}
      {toast}
    </>
  );
}
