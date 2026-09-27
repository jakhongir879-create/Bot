import { useCallback, useEffect, useState } from 'react';
import { api, periodQuery } from '../api';
import { Empty, Modal, PeriodPicker, useToast } from '../components/ui';
import { dateTime, money, todayKey } from '../utils';

function ExpenseForm({ item, categories, onClose, onSaved }) {
  const [form, setForm] = useState(
    item
      ? { category: item.category, amount: item.amount, note: item.note || '', date: '' }
      : { category: categories[0] || 'Boshqa', amount: '', note: '', date: todayKey() }
  );
  const [error, setError] = useState('');
  const save = async () => {
    try {
      const body = { ...form, amount: Number(form.amount) };
      if (form.date) body.date = new Date(`${form.date}T12:00:00+05:00`).toISOString();
      else delete body.date;
      if (item) await api.put(`/expenses/${item.id}`, body);
      else await api.post('/expenses', body);
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <Modal title={item ? 'Xarajatni tahrirlash' : 'Yangi xarajat'} onClose={onClose}>
      {error && <div className="alert">{error}</div>}
      <div className="field">
        <label>Turi</label>
        <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="row">
        <div className="field">
          <label>Summa (so'm)</label>
          <input className="input" type="number" value={form.amount} autoFocus onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div className="field">
          <label>Sana {item && <span className="muted">(o'zgartirmaslik uchun bo'sh qoldiring)</span>}</label>
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label>Izoh</label>
        <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>Bekor qilish</button>
        <button className="btn primary" disabled={!form.amount} onClick={save}>Saqlash</button>
      </div>
    </Modal>
  );
}

export default function Expenses() {
  const [period, setPeriod] = useState({ period: 'month' });
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [toast, showToast] = useToast();

  const load = useCallback(() => {
    api.get(`/expenses?${periodQuery(period)}`).then(setItems);
  }, [period]);
  useEffect(load, [load]);
  useEffect(() => {
    api.get('/meta').then((m) => setCategories(m.expenseCategories));
  }, []);

  const remove = async (x) => {
    if (!confirm("Xarajatni o'chirasizmi?")) return;
    await api.del(`/expenses/${x.id}`);
    showToast("O'chirildi");
    load();
  };

  const shown = filter ? items.filter((x) => x.category === filter) : items;
  const total = shown.reduce((s, x) => s + x.amount, 0);
  const byCat = categories
    .map((c) => ({ c, v: items.filter((x) => x.category === c).reduce((s, x) => s + x.amount, 0) }))
    .filter((x) => x.v > 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Xarajatlar</h1>
          <p>Jami: <b>{money(total)}</b></p>
        </div>
        <button className="btn primary" onClick={() => setEditing({})}>+ Xarajat qo'shish</button>
      </div>
      <div className="card">
        <div className="card-head">
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
        {byCat.length > 0 && (
          <div className="chips" style={{ marginBottom: 12 }}>
            <button className={`chip ${!filter ? 'active' : ''}`} onClick={() => setFilter('')}>Hammasi</button>
            {byCat.map(({ c, v }) => (
              <button key={c} className={`chip ${filter === c ? 'active' : ''}`} onClick={() => setFilter(c)}>
                {c} • {money(v)}
              </button>
            ))}
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sana</th>
                <th>Turi</th>
                <th>Izoh</th>
                <th className="num">Summa</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((x) => (
                <tr key={x.id}>
                  <td className="small">{dateTime(x.date)}</td>
                  <td><span className="badge">{x.category}</span></td>
                  <td className="muted">{x.note || '—'}</td>
                  <td className="num"><b>{money(x.amount)}</b></td>
                  <td className="num">
                    <button className="icon-btn" onClick={() => setEditing(x)} aria-label="Tahrirlash">✏️</button>
                    <button className="icon-btn" onClick={() => remove(x)} aria-label="O'chirish">🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <Empty>Bu davrda xarajat yo'q</Empty>}
        </div>
      </div>
      {editing && (
        <ExpenseForm
          item={editing.id ? editing : null}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            showToast('✅ Saqlandi');
            load();
          }}
        />
      )}
      {toast}
    </>
  );
}
