import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { PageHead, AiBlock, Loading, useAsync, Modal, Empty, toast, Pill } from '../components/ui.jsx';
import { money, num, formatDate, isoDay } from '../utils.js';

function CheckModal({ id, onClose }) {
  const { data, loading } = useAsync(() => (id ? api.stockCheck(id) : Promise.resolve(null)), [id]);
  const [onlyDiff, setOnlyDiff] = useState(true);
  if (!id) return null;
  const check = data?.check;
  const items = check ? check.items.filter((i) => !onlyDiff || i.diffQty !== 0) : [];
  return (
    <Modal open onClose={onClose} wide title={check ? `Sverka: ${check.warehouse}, ${formatDate(check.checkDate)}` : 'Sverka'}>
      {loading || !check ? (
        <Loading />
      ) : (
        <>
          <div className="row wrap" style={{ gap: 24, marginBottom: 16 }}>
            <div><div className="kpi-label">Mas'ul</div><b>{check.responsible}</b></div>
            <div><div className="kpi-label">Kamomad</div><b className="tone-red">{money(check.shortageSum)}</b></div>
            <div><div className="kpi-label">Ortiqcha</div><b className="tone-green">{money(check.surplusSum)}</b></div>
            <div><div className="kpi-label">Sof farq</div><b>{money(check.totalDiff)}</b></div>
            <div><div className="kpi-label">Fayl</div><span className="small">{check.fileName}</span></div>
          </div>
          <label className="checkbox small" style={{ marginBottom: 10 }}>
            <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
            Faqat farqli tovarlar ({check.items.filter((i) => i.diffQty !== 0).length} / {check.items.length})
          </label>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Tovar</th>
                  <th className="num">Dasturda</th>
                  <th className="num">Haqiqiy</th>
                  <th className="num">Narx</th>
                  <th className="num">Farq (dona)</th>
                  <th className="num">Farq (summa)</th>
                  <th>Mas'ul</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td className="small muted">{i.code || '—'}</td>
                    <td>{i.name}</td>
                    <td className="num">{num(i.systemQty, 2)}</td>
                    <td className="num">{num(i.actualQty, 2)}</td>
                    <td className="num">{money(i.price)}</td>
                    <td className={`num ${i.diffQty < 0 ? 'neg' : i.diffQty > 0 ? 'pos' : ''}`}>{i.diffQty > 0 ? '+' : ''}{num(i.diffQty, 2)}</td>
                    <td className={`num ${i.diffSum < 0 ? 'neg' : i.diffSum > 0 ? 'pos' : ''}`}>{money(i.diffSum)}</td>
                    <td className="small">{i.responsible || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && <Empty>Farq topilmadi</Empty>}
          </div>
        </>
      )}
    </Modal>
  );
}

export default function Stock() {
  const { data, error, loading, reload } = useAsync(() => api.stock(), []);
  const [openId, setOpenId] = useState(null);
  const [over, setOver] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ warehouse: 'Asosiy sklad', responsible: '', checkDate: isoDay() });
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const inputRef = useRef(null);

  const pickFile = (f) => {
    setUploadError(null);
    if (!f) return;
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) return setUploadError('Faqat Excel (.xlsx, .xls) yoki .csv fayl yuklang');
    if (f.size > 5 * 1024 * 1024) return setUploadError('Fayl hajmi 5 MB dan oshmasligi kerak');
    setFile(f);
  };

  const upload = async () => {
    setBusy(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      const res = await api.uploadStock(fd);
      toast(`Sverka saqlandi: ${res.itemsWithDiff} ta tovarda farq`);
      setFile(null);
      await reload();
      setOpenId(res.check.id);
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.stockTemplate();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sverka-shablon.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Bu sverkani o'chirasizmi?")) return;
    await api.deleteStockCheck(id);
    toast("Sverka o'chirildi");
    reload();
  };

  return (
    <>
      <PageHead title="Sklad sverka" sub="Excel orqali inventarizatsiya natijalarini solishtirish">
        <button className="btn ghost" onClick={downloadTemplate}>
          <Download size={16} strokeWidth={1.75} /> Namunaviy shablon
        </button>
      </PageHead>

      <div className="grid grid-2">
        <div>
          <div
            className={`dropzone ${over ? 'over' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
          >
            <div className="big"><FileSpreadsheet size={44} strokeWidth={1.5} color="#1baf7a" /></div>
            <div className="bold" style={{ marginTop: 8 }}>{file ? file.name : 'Excel faylni shu yerga tashlang'}</div>
            <div className="small muted">yoki tanlash uchun bosing · .xlsx, .xls, .csv · 5 MB gacha</div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
          </div>
          <div className="small muted" style={{ marginTop: 8 }}>
            Ustun nomlari farq qilsa ham tanib olinadi: «Qoldiq», «Ostatok», «Остаток», «Факт», «Haqiqiy», «Narx», «Цена» va h.k.
          </div>
        </div>
        <div className="card">
          <div className="form-grid">
            <label className="field">
              <span>Sklad nomi</span>
              <input className="input" value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} />
            </label>
            <label className="field">
              <span>Mas'ul shaxs</span>
              <input className="input" value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} placeholder="Ism familiya" />
            </label>
            <label className="field">
              <span>Sverka sanasi</span>
              <input className="input" type="date" value={form.checkDate} onChange={(e) => setForm({ ...form, checkDate: e.target.value })} />
            </label>
          </div>
          {uploadError && <div className="alert">{uploadError}</div>}
          <button className="btn" style={{ width: '100%' }} disabled={!file || busy} onClick={upload}>
            {busy ? 'Yuklanmoqda...' : 'Yuklash va solishtirish'}
          </button>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}
      {loading && !data ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="section-title">Sverkalar tarixi</div>
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Sana</th>
                      <th>Sklad</th>
                      <th>Mas'ul</th>
                      <th className="num">Tovarlar</th>
                      <th className="num">Kamomad</th>
                      <th className="num">Ortiqcha</th>
                      <th className="num">Sof farq</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.checks.map((c) => (
                      <tr key={c.id} className="clickable" onClick={() => setOpenId(c.id)}>
                        <td>{formatDate(c.checkDate)}</td>
                        <td>{c.warehouse}</td>
                        <td>{c.responsible}</td>
                        <td className="num">{c.itemCount}</td>
                        <td className="num neg">{money(c.shortageSum)}</td>
                        <td className="num pos">{money(c.surplusSum)}</td>
                        <td className={`num bold ${c.totalDiff < 0 ? 'neg' : ''}`}>{money(c.totalDiff)}</td>
                        <td className="num">
                          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); remove(c.id); }} title="O'chirish"><Trash2 size={16} strokeWidth={1.75} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.checks.length && <Empty>Hali sverka o'tkazilmagan</Empty>}
              </div>
            </div>

            <div className="grid grid-2" style={{ marginTop: 16 }}>
              <div className="card">
                <div className="card-title">Mas'ul shaxslar bo'yicha farqlar</div>
                <div className="card-sub">Barcha sverkalar bo'yicha jami</div>
                <table>
                  <thead>
                    <tr><th>Mas'ul</th><th className="num">Sverkalar</th><th className="num">Farqli tovar</th><th className="num">Kamomad</th><th className="num">Ortiqcha</th></tr>
                  </thead>
                  <tbody>
                    {data.byResponsible.map((r) => (
                      <tr key={r.responsible}>
                        <td><b>{r.responsible}</b></td>
                        <td className="num">{r.checks}</td>
                        <td className="num">{r.items}</td>
                        <td className="num neg">{money(r.shortage)}</td>
                        <td className="num pos">{money(r.surplus)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.byResponsible.length && <Empty />}
              </div>
              <div className="card">
                <div className="card-title">Takrorlanuvchi farqlar</div>
                <div className="card-sub">Bir necha sverkada farq chiqqan tovarlar — jiddiy e'tibor talab qiladi</div>
                <table>
                  <thead>
                    <tr><th>Tovar</th><th className="num">Necha marta</th><th className="num">Jami farq</th><th>Mas'ul</th></tr>
                  </thead>
                  <tbody>
                    {data.repeated.slice(0, 15).map((p) => (
                      <tr key={p.code || p.name}>
                        <td>{p.name}</td>
                        <td className="num"><Pill tone="red">{p.checks}×</Pill></td>
                        <td className={`num ${p.totalDiffSum < 0 ? 'neg' : 'pos'}`}>{money(p.totalDiffSum)}</td>
                        <td className="small">{p.responsibles.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.repeated.length && <Empty>Takrorlanuvchi farq yo'q</Empty>}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <AiBlock module="SKLAD" title="AI tahlil: sklad" compact />
            </div>
          </>
        )
      )}
      <CheckModal id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
