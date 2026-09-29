import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Sheet, toast } from './ui.jsx';
import { haptic, showAlert } from '../telegram.js';
import { toLocalInput, fromLocalInput } from '../utils.js';

function presetDate(days) {
  const d = new Date(Date.now() + days * 86400000);
  const local = toLocalInput(d).slice(0, 10);
  let result = fromLocalInput(`${local}T18:00`);
  if (days === 0 && result < new Date()) result = fromLocalInput(`${local}T23:59`);
  return result;
}

const PRESETS = [
  ['Bugun', 0],
  ['Ertaga', 1],
  ['3 kun', 3],
  ['1 hafta', 7],
];

export default function NewTaskSheet({ open, onClose, onCreated }) {
  const [people, setPeople] = useState([]);
  const [form, setForm] = useState({ assigneeId: '', title: '', description: '', deadline: toLocalInput(presetDate(1)), priority: 'ORTA' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ assigneeId: '', title: '', description: '', deadline: toLocalInput(presetDate(1)), priority: 'ORTA' });
    api
      .assignees()
      .then((d) => setPeople(d.employees))
      .catch((e) => showAlert(e.message));
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target ? e.target.value : e }));
  const valid = form.assigneeId && form.title.trim().length >= 3 && form.deadline;

  const submit = async () => {
    setBusy(true);
    try {
      await api.createTask({ ...form, assigneeId: Number(form.assigneeId), deadline: fromLocalInput(form.deadline).toISOString() });
      haptic('success');
      toast('Vazifa yuborildi');
      onCreated?.();
      onClose();
    } catch (e) {
      haptic('error');
      showAlert(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Yangi vazifa"
      footer={
        <button className="btn" disabled={!valid || busy} onClick={submit}>
          {busy ? 'Yuborilmoqda...' : 'Vazifani yuborish'}
        </button>
      }
    >
      <label className="field">
        <span>Kimga</span>
        <select className="input" value={form.assigneeId} onChange={set('assigneeId')}>
          <option value="">Xodimni tanlang</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName} — {p.position || p.roleLabel}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Sarlavha</span>
        <input className="input" value={form.title} onChange={set('title')} placeholder="Masalan: Oylik hisobotni tayyorlash" maxLength={200} />
      </label>
      <label className="field">
        <span>Tavsif</span>
        <textarea className="input" value={form.description} onChange={set('description')} placeholder="Nima qilish kerak va natija qanday bo'lishi kerak" />
      </label>
      <div className="field">
        <span>Deadline</span>
        <div className="option-grid" style={{ marginBottom: 8 }}>
          {PRESETS.map(([label, days]) => {
            const value = toLocalInput(presetDate(days));
            return (
              <button key={label} className={`option ${form.deadline === value ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, deadline: value }))}>
                {label}
              </button>
            );
          })}
        </div>
        <input className="input" type="datetime-local" value={form.deadline} onChange={set('deadline')} />
      </div>
      <div className="field">
        <span>Muhimlik</span>
        <div className="option-grid">
          {[
            ['PAST', '🟢 Past'],
            ['ORTA', "🟡 O'rta"],
            ['YUQORI', '🔴 Yuqori'],
          ].map(([key, label]) => (
            <button key={key} className={`option ${form.priority === key ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, priority: key }))}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
