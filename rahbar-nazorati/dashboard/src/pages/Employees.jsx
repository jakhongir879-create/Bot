import React, { useState } from 'react';
import { Package, Pencil } from 'lucide-react';
import { api } from '../api.js';
import { PageHead, Loading, useAsync, Modal, Empty, Pill, toast } from '../components/ui.jsx';
import { ROLES } from '../utils.js';

const EMPTY = { fullName: '', phone: '+998', position: '', department: '', role: 'MIDDLE', managerId: '', isStockResponsible: false };

function EmployeeForm({ employee, all, onClose, onSaved }) {
  const [form, setForm] = useState(() => (employee.id ? { ...EMPTY, ...employee, managerId: employee.managerId || '', position: employee.position || '', department: employee.department || '' } : EMPTY));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const managers = all.filter((e) => e.isActive && e.id !== employee.id && e.role !== 'MIDDLE');
  const save = async () => {
    setBusy(true);
    try {
      await api.saveEmployee({ ...form, managerId: form.managerId ? Number(form.managerId) : null }, employee.id);
      toast('Xodim saqlandi');
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={employee.id ? 'Xodimni tahrirlash' : "Yangi xodim qo'shish"}>
      <div className="form-grid">
        <label className="field"><span>Ism familiya</span><input className="input" value={form.fullName} onChange={set('fullName')} /></label>
        <label className="field"><span>Telefon raqam</span><input className="input" value={form.phone} onChange={set('phone')} placeholder="+998901234567" /></label>
        <label className="field"><span>Lavozim</span><input className="input" value={form.position} onChange={set('position')} /></label>
        <label className="field"><span>Bo'lim</span><input className="input" value={form.department} onChange={set('department')} /></label>
        <label className="field">
          <span>Rol</span>
          <select className="input" value={form.role} onChange={set('role')}>
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {form.role !== 'DIRECTOR' && (
          <label className="field">
            <span>Rahbari (kimga bo'ysunadi)</span>
            <select className="input" value={form.managerId} onChange={set('managerId')}>
              <option value="">— Tanlanmagan —</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.fullName} ({ROLES[m.role]})</option>)}
            </select>
          </label>
        )}
      </div>
      <label className="checkbox" style={{ marginBottom: 8 }}>
        <input type="checkbox" checked={form.isStockResponsible} onChange={set('isStockResponsible')} />
        Sklad mas'uli (botga Excel sverka yubora oladi)
      </label>
      <div className="small muted">Xodim botga /start yozib, shu telefon raqamini yuborganda tizimga ulanadi.</div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Bekor qilish</button>
        <button className="btn" onClick={save} disabled={busy || !form.fullName.trim()}>Saqlash</button>
      </div>
    </Modal>
  );
}

export default function Employees() {
  const { data, error, loading, reload } = useAsync(() => api.employees(), []);
  const [editing, setEditing] = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  const toggle = async (e) => {
    if (e.isActive && !window.confirm(`${e.fullName} faolsizlantirilsinmi? U botdan foydalana olmaydi.`)) return;
    try {
      await api.setEmployeeActive(e.id, !e.isActive);
      toast(e.isActive ? 'Xodim faolsizlantirildi' : 'Xodim qayta faollashtirildi');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (loading && !data) return <Loading />;
  if (error) return <div className="alert">{error}</div>;
  const list = data.employees.filter((e) => showInactive || e.isActive);

  return (
    <>
      <PageHead title="Xodimlar" sub={`${data.employees.filter((e) => e.isActive).length} ta faol xodim`}>
        <label className="checkbox small">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Faolsizlarni ko'rsatish
        </label>
        <button className="btn" onClick={() => setEditing({})}>+ Xodim qo'shish</button>
      </PageHead>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Xodim</th><th>Telefon</th><th>Rol</th><th>Bo'lim</th><th>Rahbari</th><th>Telegram</th><th>Holat</th><th /></tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} style={{ opacity: e.isActive ? 1 : 0.5 }}>
                  <td>
                    <b>{e.fullName}</b>
                    <div className="small muted">{e.position}{e.isStockResponsible && <span className="row" style={{ gap: 4, display: 'inline-flex' }}> · <Package size={13} strokeWidth={1.75} /> sklad mas'uli</span>}</div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{e.phone}</td>
                  <td><Pill tone={e.role === 'DIRECTOR' ? 'blue' : e.role === 'TOP' ? 'orange' : 'muted'}>{e.roleLabel}</Pill></td>
                  <td>{e.department || '—'}</td>
                  <td className="small">{e.manager?.fullName || '—'}</td>
                  <td>{e.telegramId ? <Pill tone="green">✓ Ulangan</Pill> : <Pill tone="muted">Kutilmoqda</Pill>}</td>
                  <td>{e.isActive ? <Pill tone="green">Faol</Pill> : <Pill tone="red">Faolsiz</Pill>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="icon-btn" onClick={() => setEditing(e)} title="Tahrirlash"><Pencil size={16} strokeWidth={1.75} /></button>
                    {(e.role !== 'DIRECTOR' || !e.isActive) && (
                      <button className="btn ghost sm" onClick={() => toggle(e)}>{e.isActive ? 'Faolsizlantirish' : 'Faollashtirish'}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <Empty />}
        </div>
      </div>
      {editing && <EmployeeForm employee={editing} all={data.employees} onClose={() => setEditing(null)} onSaved={reload} />}
    </>
  );
}
