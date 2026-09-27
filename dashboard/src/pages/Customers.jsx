import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Empty, Modal, useToast } from '../components/ui';
import { money } from '../utils';

function CustomerForm({ item, onClose, onSaved }) {
  const [form, setForm] = useState(item || { name: '', phone: '', note: '' });
  const [error, setError] = useState('');
  const save = async () => {
    try {
      const body = { name: form.name, phone: form.phone, note: form.note };
      if (item) await api.put(`/customers/${item.id}`, body);
      else await api.post('/customers', body);
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <Modal title={item ? 'Mijozni tahrirlash' : 'Yangi mijoz'} onClose={onClose}>
      {error && <div className="alert">{error}</div>}
      <div className="field">
        <label>Ism</label>
        <input className="input" value={form.name} autoFocus onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="field">
        <label>Telefon</label>
        <input className="input" value={form.phone || ''} placeholder="+998" onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div className="field">
        <label>Izoh</label>
        <input className="input" value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>Bekor qilish</button>
        <button className="btn primary" disabled={!form.name} onClick={save}>Saqlash</button>
      </div>
    </Modal>
  );
}

export default function Customers() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [toast, showToast] = useToast();

  const load = useCallback(() => {
    api.get('/customers').then(setItems);
  }, []);
  useEffect(load, [load]);

  const remove = async (c) => {
    if (!confirm(`"${c.name}" ni o'chirasizmi? Sotuvlar saqlanib qoladi.`)) return;
    await api.del(`/customers/${c.id}`);
    showToast("O'chirildi");
    load();
  };

  const shown = items
    .filter((c) => !q || `${c.name} ${c.phone || ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.totalSpent - a.totalSpent);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mijozlar</h1>
          <p>{items.length} ta mijoz</p>
        </div>
        <button className="btn primary" onClick={() => setEditing({})}>+ Mijoz qo'shish</button>
      </div>
      <div className="card">
        <div className="card-head">
          <h2>Mijozlar ro'yxati</h2>
          <input className="input" style={{ maxWidth: 240 }} placeholder="🔍 Ism yoki telefon" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ism</th>
                <th>Telefon</th>
                <th className="num hide-sm">Xaridlar</th>
                <th className="num">Jami xarid</th>
                <th className="num">Qarz</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.name}</b>
                    {c.note && <div className="muted small">{c.note}</div>}
                  </td>
                  <td>{c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : <span className="muted">—</span>}</td>
                  <td className="num hide-sm">{c.salesCount}</td>
                  <td className="num">{money(c.totalSpent)}</td>
                  <td className="num">{c.debt > 0 ? <span className="badge red">{money(c.debt)}</span> : <span className="muted">—</span>}</td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>
                    <button className="icon-btn" onClick={() => setEditing(c)} aria-label="Tahrirlash">✏️</button>
                    <button className="icon-btn" onClick={() => remove(c)} aria-label="O'chirish">🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <Empty>Mijoz topilmadi</Empty>}
        </div>
      </div>
      {editing && (
        <CustomerForm
          item={editing.id ? editing : null}
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
