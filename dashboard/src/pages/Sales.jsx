import { useCallback, useEffect, useState } from 'react';
import { api, periodQuery } from '../api';
import { Empty, Modal, PeriodPicker, useToast } from '../components/ui';
import { PAYMENT, dateTime, money, num } from '../utils';

export function SaleForm({ onClose, onSaved }) {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [lines, setLines] = useState([{ productId: '', quantity: 1, price: '' }]);
  const [form, setForm] = useState({ paymentMethod: 'CASH', discount: 0, paidAmount: 0, customerId: '', note: '' });
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/products').then((p) => setProducts(p.filter((x) => x.isActive)));
    api.get('/customers').then(setCustomers);
  }, []);

  const byId = (id) => products.find((p) => p.id === Number(id));
  const subtotal = lines.reduce((s, l) => {
    const p = byId(l.productId);
    const price = l.price !== '' ? Number(l.price) : p?.salePrice || 0;
    return s + price * (Number(l.quantity) || 0);
  }, 0);
  const total = Math.max(0, subtotal - (Number(form.discount) || 0));

  const setLine = (i, patch) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      let customerId = form.customerId;
      if (customerId === 'new') {
        if (!newCustomer.name) throw new Error('Mijoz ismini kiriting');
        customerId = (await api.post('/customers', newCustomer)).id;
      }
      await api.post('/sales', {
        items: lines
          .filter((l) => l.productId)
          .map((l) => ({ productId: Number(l.productId), quantity: Number(l.quantity), price: l.price === '' ? undefined : Number(l.price) })),
        paymentMethod: form.paymentMethod,
        discount: Number(form.discount) || 0,
        paidAmount: Number(form.paidAmount) || 0,
        customerId: customerId ? Number(customerId) : undefined,
        note: form.note,
      });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Yangi sotuv" onClose={onClose} wide>
      {error && <div className="alert">{error}</div>}
      {lines.map((l, i) => {
        const p = byId(l.productId);
        return (
          <div className="row" key={i} style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 3 }}>
              {i === 0 && <label>Mahsulot</label>}
              <select className="input" value={l.productId} onChange={(e) => setLine(i, { productId: e.target.value, price: '' })}>
                <option value="">Tanlang...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {money(p.salePrice)} (qoldiq {num(p.stock)})
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1, minWidth: 80 }}>
              {i === 0 && <label>Miqdor</label>}
              <input className="input" type="number" min="0" step="any" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1.3, minWidth: 110 }}>
              {i === 0 && <label>Narx</label>}
              <input className="input" type="number" placeholder={p ? String(p.salePrice) : ''} value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} />
            </div>
            <button className="icon-btn" style={{ marginBottom: 16 }} onClick={() => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : lines)} aria-label="O'chirish">
              🗑
            </button>
          </div>
        );
      })}
      <button className="btn sm" onClick={() => setLines([...lines, { productId: '', quantity: 1, price: '' }])}>
        + Mahsulot qo'shish
      </button>

      <div className="row mt">
        <div className="field">
          <label>To'lov turi</label>
          <select className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
            {Object.entries(PAYMENT).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Chegirma (so'm)</label>
          <input className="input" type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label>Mijoz {form.paymentMethod === 'DEBT' ? '(majburiy)' : '(ixtiyoriy)'}</label>
          <select className="input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
            <option value="">—</option>
            <option value="new">+ Yangi mijoz</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
            ))}
          </select>
        </div>
        {form.paymentMethod === 'DEBT' && (
          <div className="field">
            <label>Hozir to'landi (so'm)</label>
            <input className="input" type="number" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} />
          </div>
        )}
      </div>

      {form.customerId === 'new' && (
        <div className="row">
          <div className="field">
            <label>Ism</label>
            <input className="input" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Telefon</label>
            <input className="input" value={newCustomer.phone} placeholder="+998" onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
          </div>
        </div>
      )}

      <div className="field">
        <label>Izoh</label>
        <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </div>

      <div className="list-row">
        <span className="muted">Jami</span>
        <h2>{money(total)}</h2>
      </div>

      <div className="modal-foot">
        <button className="btn" onClick={onClose}>Bekor qilish</button>
        <button className="btn primary" disabled={busy || !lines.some((l) => l.productId)} onClick={save}>
          {busy ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </div>
    </Modal>
  );
}

export function PayModal({ sale, onClose, onSaved }) {
  const left = sale.total - sale.paidAmount;
  const [amount, setAmount] = useState(left);
  const [error, setError] = useState('');
  const save = async () => {
    try {
      await api.post(`/sales/${sale.id}/pay`, { amount: Number(amount) });
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <Modal title={`To'lov qabul qilish — №${sale.id}`} onClose={onClose}>
      {error && <div className="alert">{error}</div>}
      <p className="muted">
        {sale.customer?.name} • Qolgan qarz: <b>{money(left)}</b>
      </p>
      <div className="field">
        <label>Summa</label>
        <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>Bekor qilish</button>
        <button className="btn primary" onClick={save}>Qabul qilish</button>
      </div>
    </Modal>
  );
}

export default function Sales() {
  const [period, setPeriod] = useState({ period: 'week' });
  const [data, setData] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState(null);
  const [toast, showToast] = useToast();

  const load = useCallback(() => {
    api.get(`/sales?${periodQuery(period)}&page=${page}&limit=50`).then(setData);
  }, [period, page]);

  useEffect(load, [load]);

  const remove = async (s) => {
    if (!confirm(`№${s.id} sotuvni o'chirasizmi? Mahsulotlar omborga qaytariladi.`)) return;
    await api.del(`/sales/${s.id}`);
    showToast("Sotuv o'chirildi");
    load();
  };

  const sum = data.items.reduce((a, s) => a + s.total, 0);
  const pages = Math.ceil(data.total / 50);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Sotuvlar</h1>
          <p>{data.total} ta sotuv</p>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>+ Yangi sotuv</button>
      </div>
      <div className="card">
        <div className="card-head">
          <PeriodPicker value={period} onChange={(p) => { setPage(1); setPeriod(p); }} />
          <span className="muted small">Sahifadagi jami: <b>{money(sum)}</b></span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>Sana</th>
                <th>Mahsulotlar</th>
                <th className="hide-sm">Mijoz</th>
                <th>To'lov</th>
                <th className="num">Summa</th>
                <th className="num hide-sm">Foyda</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => {
                const debt = s.total - s.paidAmount;
                return (
                  <tr key={s.id}>
                    <td className="muted">{s.id}</td>
                    <td className="small">{dateTime(s.createdAt)}</td>
                    <td>
                      {s.items.map((i) => `${i.productName} ×${num(i.quantity)}`).join(', ')}
                      {s.note && <div className="muted small">📝 {s.note}</div>}
                    </td>
                    <td className="hide-sm">{s.customer?.name || <span className="muted">—</span>}</td>
                    <td>
                      <span className={`badge ${s.paymentMethod === 'DEBT' ? 'orange' : ''}`}>{PAYMENT[s.paymentMethod]}</span>
                      {debt > 0 && <div className="small" style={{ color: 'var(--bad)', marginTop: 4 }}>qarz {money(debt)}</div>}
                    </td>
                    <td className="num">
                      <b>{money(s.total)}</b>
                      {s.discount > 0 && <div className="muted small">-{money(s.discount)}</div>}
                    </td>
                    <td className="num hide-sm">{money(s.profit)}</td>
                    <td className="num">
                      {debt > 0 && (
                        <button className="btn sm" onClick={() => setPaying(s)}>To'lov</button>
                      )}{' '}
                      <button className="icon-btn" onClick={() => remove(s)} aria-label="O'chirish">🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!data.items.length && <Empty>Bu davrda sotuv yo'q</Empty>}
        </div>
        {pages > 1 && (
          <div className="row mt" style={{ justifyContent: 'center' }}>
            <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Oldingi</button>
            <span className="muted small">{page} / {pages}</span>
            <button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Keyingi →</button>
          </div>
        )}
      </div>

      {creating && (
        <SaleForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            showToast('✅ Sotuv saqlandi');
            load();
          }}
        />
      )}
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
