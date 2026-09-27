import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Empty, useToast } from '../components/ui';
import { dateTime } from '../utils';

export default function Settings({ onLogout }) {
  const [admins, setAdmins] = useState([]);
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState({ telegramId: '', name: '', role: 'MANAGER' });
  const [error, setError] = useState('');
  const [toast, showToast] = useToast();

  const load = useCallback(() => {
    api.get('/admins').then(setAdmins);
  }, []);
  useEffect(() => {
    load();
    api.get('/meta').then(setMeta);
  }, [load]);

  const add = async () => {
    setError('');
    try {
      await api.post('/admins', form);
      setForm({ telegramId: '', name: '', role: 'MANAGER' });
      showToast("✅ Xodim qo'shildi");
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggle = async (a) => {
    await api.put(`/admins/${a.id}`, { isActive: !a.isActive });
    load();
  };

  const remove = async (a) => {
    if (!confirm(`${a.name} ni o'chirasizmi?`)) return;
    await api.del(`/admins/${a.id}`);
    load();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Sozlamalar</h1>
          <p>Botdan foydalanuvchi xodimlar va umumiy sozlamalar</p>
        </div>
        <button className="btn" onClick={onLogout}>Chiqish</button>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="card-head"><h2>👥 Bot foydalanuvchilari</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ism</th>
                  <th>Telegram ID</th>
                  <th>Rol</th>
                  <th className="hide-sm">Qo'shilgan</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id} style={{ opacity: a.isActive ? 1 : 0.5 }}>
                    <td>
                      <b>{a.name}</b>
                      {a.username && <div className="muted small">@{a.username}</div>}
                    </td>
                    <td><code>{a.telegramId}</code></td>
                    <td><span className={`badge ${a.role === 'OWNER' ? 'blue' : ''}`}>{a.role === 'OWNER' ? 'Egasi' : 'Menejer'}</span></td>
                    <td className="small hide-sm">{dateTime(a.createdAt)}</td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn sm" onClick={() => toggle(a)}>{a.isActive ? "O'chirish" : 'Yoqish'}</button>
                      <button className="icon-btn" onClick={() => remove(a)} aria-label="O'chirish">🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!admins.length && <Empty>Hali hech kim yo'q. Botga /start yozing.</Empty>}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>+ Xodim qo'shish</h2></div>
          {error && <div className="alert">{error}</div>}
          <p className="muted small" style={{ marginTop: 0 }}>
            Xodim botga <b>/id</b> yozib o'z Telegram ID sini bilib oladi va sizga yuboradi.
          </p>
          <div className="field">
            <label>Telegram ID</label>
            <input className="input" value={form.telegramId} placeholder="123456789" onChange={(e) => setForm({ ...form, telegramId: e.target.value.replace(/\D/g, '') })} />
          </div>
          <div className="field">
            <label>Ism</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Rol</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="MANAGER">Menejer</option>
              <option value="OWNER">Egasi</option>
            </select>
          </div>
          <button className="btn primary" disabled={!form.telegramId || !form.name} onClick={add}>Qo'shish</button>
        </div>
      </div>

      {meta && (
        <div className="card mt">
          <div className="card-head"><h2>ℹ️ Umumiy maʼlumot</h2></div>
          <div className="list-row"><span className="muted">Biznes nomi</span><b>{meta.businessName}</b></div>
          <div className="list-row"><span className="muted">Kunlik hisobot vaqti</span><b>{meta.dailyReportTime}</b></div>
          <div className="list-row"><span className="muted">Haftalik hisobot</span><b>Har dushanba 09:00</b></div>
          <div className="list-row"><span className="muted">Oylik hisobot</span><b>Har oyning 1-kuni 09:05</b></div>
          <p className="notice small">Bu qiymatlarni o'zgartirish uchun <code>backend/.env</code> faylini tahrirlang va serverni qayta ishga tushiring.</p>
        </div>
      )}
      {toast}
    </>
  );
}
