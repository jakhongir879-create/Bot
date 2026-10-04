import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, PenLine, Check, CheckCheck, Star, Paperclip, XCircle, Image, FileText } from 'lucide-react';
import { api } from '../api.js';
import { Sheet, Spinner, StatusPill, PriorityPill, toast } from './ui.jsx';
import { haptic, showAlert } from '../telegram.js';
import { STATUS, REASONS, REASON_LABEL, formatDateTime, timeLeft, deadlineTone } from '../utils.js';

const ACTIVE = ['YANGI', 'QABUL_QILINDI', 'JARAYONDA', 'QAYTARILDI'];

export default function TaskSheet({ taskId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(null); // 'fail' | 'overdue' | 'return'
  const [progress, setProgress] = useState(0);
  const [reason, setReason] = useState(null);
  const [reasonText, setReasonText] = useState('');
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const d = await api.task(taskId);
      setData(d);
      setProgress(Math.max(25, d.task.progress || 25));
    } catch (e) {
      showAlert(e.message);
      onClose();
    }
  }, [taskId, onClose]);

  useEffect(() => {
    if (!taskId) return;
    setData(null);
    setMode(null);
    setReason(null);
    setReasonText('');
    setStars(0);
    setComment('');
    load();
  }, [taskId, load]);

  const run = async (payload, successText) => {
    setBusy(true);
    try {
      await api.action(taskId, payload);
      haptic('success');
      toast(successText);
      setMode(null);
      await load();
      onChanged?.();
    } catch (e) {
      haptic('error');
      showAlert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return showAlert("Fayl hajmi 10 MB dan oshmasligi kerak");
    setBusy(true);
    try {
      await api.upload(taskId, file);
      haptic('success');
      toast('Fayl yuklandi va beruvchiga yuborildi');
      await load();
    } catch (e) {
      showAlert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendFile = async (fileId) => {
    try {
      await api.sendFile(fileId);
      toast('Fayl Telegram chatingizga yuborildi');
    } catch (e) {
      showAlert(e.message);
    }
  };

  if (!taskId) return null;
  if (!data) {
    return (
      <Sheet open onClose={onClose}>
        <Spinner />
      </Sheet>
    );
  }

  const { task, history, files, permissions } = data;
  const isActive = ACTIVE.includes(task.status);
  const canWork = permissions.isAssignee && isActive;
  const canRate = permissions.isAssigner && task.status === 'BAJARILDI' && !task.qualityScore;
  const needsOverdueReason = permissions.isAssignee && task.isOverdue && !task.failReason;

  const reasonValid = reason && (reason !== 'BOSHQA' || reasonText.trim());

  let footer = null;
  if (mode === 'fail' || mode === 'overdue') {
    footer = (
      <div className="btn-row">
        <button className="btn ghost" onClick={() => setMode(null)} disabled={busy}>
          Bekor qilish
        </button>
        <button
          className={`btn ${mode === 'fail' ? 'danger' : ''}`}
          disabled={!reasonValid || busy}
          onClick={() =>
            run({ action: mode === 'fail' ? 'fail' : 'overdueReason', reason, reasonText: reasonText.trim() || undefined }, 'Sabab yuborildi')
          }
        >
          Yuborish
        </button>
      </div>
    );
  } else if (mode === 'return') {
    footer = (
      <div className="btn-row">
        <button className="btn ghost" onClick={() => setMode(null)} disabled={busy}>
          Bekor qilish
        </button>
        <button className="btn danger" disabled={!comment.trim() || busy} onClick={() => run({ action: 'return', comment: comment.trim() }, 'Qayta ishlashga qaytarildi')}>
          <RotateCcw size={18} /> Qaytarish
        </button>
      </div>
    );
  } else if (needsOverdueReason) {
    footer = (
      <button className="btn danger" onClick={() => setMode('overdue')}>
        <PenLine size={18} /> Kechikish sababini yozish
      </button>
    );
  } else if (canWork && ['YANGI', 'QAYTARILDI'].includes(task.status)) {
    footer = (
      <button className="btn" disabled={busy} onClick={() => run({ action: 'accept' }, 'Vazifa qabul qilindi')}>
        <Check size={19} strokeWidth={2.4} /> Qabul qildim
      </button>
    );
  } else if (canWork) {
    footer = (
      <button className="btn success" disabled={busy} onClick={() => run({ action: 'complete' }, 'Ajoyib! Vazifa bajarildi')}>
        <CheckCheck size={19} strokeWidth={2.4} /> Bajarildi
      </button>
    );
  } else if (canRate) {
    footer = (
      <button className="btn" disabled={!stars || busy} onClick={() => run({ action: 'rate', score: stars }, 'Baho qo\'yildi')}>
        <Star size={18} /> Baholash{stars ? ` (${stars})` : ''}
      </button>
    );
  }

  return (
    <Sheet open onClose={onClose} footer={footer}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <StatusPill task={task} />
        <PriorityPill priority={task.priority} />
      </div>
      <div className="sheet-title">{task.title}</div>
      {task.description && (
        <div className="card" style={{ whiteSpace: 'pre-wrap', marginBottom: 10 }}>
          {task.description}
        </div>
      )}

      <div className="card">
        <dl className="kv">
          <dt>Beruvchi</dt>
          <dd>{task.assigner?.fullName}</dd>
          <dt>Ijrochi</dt>
          <dd>{task.assignee?.fullName}</dd>
          <dt>Deadline</dt>
          <dd>
            {formatDateTime(task.deadline)}
            {isActive && <div className={`small tone-${deadlineTone(task)}`}>{timeLeft(task.deadline)}</div>}
          </dd>
          <dt>Bajarilish</dt>
          <dd>{task.progress}%</dd>
          {task.qualityScore && (
            <>
              <dt>Sifat bahosi</dt>
              <dd className="star-value" style={{ justifyContent: 'flex-end' }}>{Array.from({ length: task.qualityScore }, (_, i) => <Star key={i} size={15} strokeWidth={0} fill="#f5a623" />)}</dd>
            </>
          )}
          {task.returnCount > 0 && (
            <>
              <dt>Qaytarilgan</dt>
              <dd>{task.returnCount} marta</dd>
            </>
          )}
          {task.failReason && (
            <>
              <dt>Sabab</dt>
              <dd>
                {REASON_LABEL[task.failReason]}
                {task.failReasonText && <div className="small muted">{task.failReasonText}</div>}
              </dd>
            </>
          )}
        </dl>
      </div>

      {(mode === 'fail' || mode === 'overdue') && (
        <>
          <div className="section-title">{mode === 'fail' ? 'Nima uchun bajara olmaysiz?' : 'Kechikish sababi'}</div>
          <div className="list">
            {REASONS.map((r) => (
              <button key={r.key} className="list-item" onClick={() => setReason(r.key)}>
                <span className="grow">{r.label}</span>
                {reason === r.key && <span className="tone-blue bold">✓</span>}
              </button>
            ))}
          </div>
          {reason === 'BOSHQA' && (
            <textarea className="input" style={{ marginTop: 10 }} placeholder="Sababni yozing..." value={reasonText} onChange={(e) => setReasonText(e.target.value)} />
          )}
        </>
      )}

      {mode === 'return' && (
        <>
          <div className="section-title">Nima uchun qaytaryapsiz?</div>
          <textarea className="input" placeholder="Izoh ijrochiga yuboriladi..." value={comment} onChange={(e) => setComment(e.target.value)} autoFocus />
        </>
      )}

      {!mode && canWork && (
        <>
          <div className="section-title">Jarayon</div>
          <div className="card">
            <div className="row between">
              <span>Bajarilish foizi</span>
              <b>{progress}%</b>
            </div>
            <input type="range" min="5" max="95" step="5" value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
            <button className="btn secondary" style={{ marginTop: 8 }} disabled={busy} onClick={() => run({ action: 'progress', progress }, `Jarayonda: ${progress}%`)}>
              Jarayonda — {progress}%
            </button>
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Paperclip size={18} /> Fayl yuklash
            </button>
            <button className="btn danger" disabled={busy} onClick={() => setMode('fail')}>
              <XCircle size={18} /> Bajara olmayman
            </button>
          </div>
          <input ref={fileRef} type="file" hidden onChange={onFile} />
        </>
      )}

      {!mode && canRate && (
        <>
          <div className="section-title">Ish sifatini baholang</div>
          <div className="card">
            <div className="stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={n <= stars ? 'on' : ''}
                  onClick={() => {
                    haptic('light');
                    setStars(n);
                  }}
                  aria-label={`${n} yulduz`}
                >
                  <Star size={36} strokeWidth={1.4} fill={n <= stars ? '#f5a623' : 'none'} color={n <= stars ? '#f5a623' : 'var(--muted)'} />
                </button>
              ))}
            </div>
            <button className="btn danger" style={{ marginTop: 12 }} onClick={() => setMode('return')}>
              <RotateCcw size={18} /> Qayta ishlashga qaytarish
            </button>
          </div>
        </>
      )}

      {files.length > 0 && (
        <>
          <div className="section-title">Fayllar</div>
          <div className="list">
            {files.map((f) => (
              <button key={f.id} className="list-item" onClick={() => sendFile(f.id)}>
                {f.fileType === 'photo' ? <Image size={22} strokeWidth={1.6} color="var(--accent)" /> : <FileText size={22} strokeWidth={1.6} color="var(--accent)" />}
                <div className="grow">
                  <div className="ellipsis">{f.fileName}</div>
                  <div className="small muted">
                    {f.by} · {formatDateTime(f.uploadedAt)}
                    {f.isLate && <span className="tone-red"> · kechikib</span>}
                  </div>
                </div>
                <span className="small tone-blue">Olish</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="section-title">Holat tarixi</div>
      <div className="card">
        <div className="timeline">
          {history.map((h) => (
            <div className="timeline-item" key={h.id}>
              <div className="bold">{STATUS[h.newStatus]?.label}</div>
              {h.comment && <div className="small">{h.comment}</div>}
              <div className="small muted">
                {h.by} · {formatDateTime(h.createdAt)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
