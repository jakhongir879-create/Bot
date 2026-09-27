import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Empty, Modal, useToast } from '../components/ui';
import { money, num } from '../utils';

const EMPTY = { name: '', sku: '', unit: 'dona', costPrice: '', salePrice: '', stock: 0, minStock: 5, categoryId: '', isActive: true };

function ProductForm({ item, categories, onClose, onSaved }) {
  const [form, setForm] = useState(item ? { ...item, categoryId: item.categoryId || '' } : EMPTY);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async () => {
    try {
      const { category, createdAt, updatedAt, id, ...body } = form;
      if (item) await api.put(`/products/${item.id}`, body);
      else await api.post('/products', body);
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  };
  const margin = form.salePrice ? Math.round(((form.salePrice - form.costPrice) / form.salePrice) * 100) : 0;
  return (
    <Modal title={item ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'} onClose={onClose}>
      {error && <div className="alert">{error}</div>}
      <div className="field">
        <label>Nomi</label>
        <input className="input" value={form.name} onChange={set('name')} autoFocus />
      </div>
      <div className="row">
        <div className="field">
          <label>Kategoriya</label>
          <select className="input" value={form.categoryId} onChange={set('categoryId')}>
            <option value="">—</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>O'lchov birligi</label>
          <select className="input" value={form.unit} onChange={set('unit')}>
            {['dona', 'kg', 'litr', 'metr', 'quti', 'paket', 'xizmat'].map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>Tannarx (so'm)</label>
          <input className="input" type="number" value={form.costPrice} onChange={set('costPrice')} />
        </div>
        <div className="field">
          <label>Sotish narxi (so'm)</label>
          <input className="input" type="number" value={form.salePrice} onChange={set('salePrice')} />
        </div>
      </div>
      {form.salePrice > 0 && <p className="muted small" style={{ marginTop: -4 }}>Ustama: {money(form.salePrice - form.costPrice)} ({margin}%)</p>}
      <div className="row">
        <div className="field">
          <label>Ombordagi qoldiq</label>
          <input className="input" type="number" step="any" value={form.stock} onChange={set('stock')} />
        </div>
        <div className="field">
          <label>Minimal qoldiq (ogohlantirish)</label>
          <input className="input" type="number" step="any" value={form.minStock} onChange={set('minStock')} />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>Artikul / SKU (ixtiyoriy)</label>
          <input className="input" value={form.sku || ''} onChange={set('sku')} />
        </div>
        <label className="row small" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={form.isActive} onChange={set('isActive')} /> Faol (sotuvda)
        </label>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>Bekor qilish</button>
        <button className="btn primary" disabled={!form.name || form.salePrice === ''} onClick={save}>Saqlash</button>
      </div>
    </Modal>
  );
}

function StockModal({ item, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const save = async () => {
    await api.put(`/products/${item.id}`, { stock: Number(item.stock) + Number(amount) });
    onSaved();
  };
  return (
    <Modal title={`Kirim — ${item.name}`} onClose={onClose}>
      <p className="muted">Hozirgi qoldiq: <b>{num(item.stock)} {item.unit}</b></p>
      <div className="field">
        <label>Qancha keldi? (ayirish uchun minus: -5)</label>
        <input className="input" type="number" step="any" value={amount} autoFocus onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>Bekor qilish</button>
        <button className="btn primary" disabled={!Number(amount)} onClick={save}>Saqlash</button>
      </div>
    </Modal>
  );
}

function CategoryModal({ categories, onClose, onChanged }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const add = async () => {
    try {
      await api.post('/categories', { name });
      setName('');
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };
  const remove = async (c) => {
    if (!confirm(`"${c.name}" kategoriyasini o'chirasizmi?`)) return;
    await api.del(`/categories/${c.id}`);
    onChanged();
  };
  const rename = async (c) => {
    const n = prompt('Yangi nom', c.name);
    if (n && n !== c.name) {
      await api.put(`/categories/${c.id}`, { name: n });
      onChanged();
    }
  };
  return (
    <Modal title="Kategoriyalar" onClose={onClose}>
      {error && <div className="alert">{error}</div>}
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="input" style={{ flex: 1 }} placeholder="Yangi kategoriya" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn primary" disabled={!name} onClick={add}>Qo'shish</button>
      </div>
      {categories.map((c) => (
        <div className="list-row" key={c.id}>
          <span>{c.name} <span className="muted small">({c._count?.products || 0} ta)</span></span>
          <span>
            <button className="icon-btn" onClick={() => rename(c)}>✏️</button>
            <button className="icon-btn" onClick={() => remove(c)}>🗑</button>
          </span>
        </div>
      ))}
    </Modal>
  );
}

export default function Products() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [stockItem, setStockItem] = useState(null);
  const [showCats, setShowCats] = useState(false);
  const [toast, showToast] = useToast();

  const load = useCallback(() => {
    api.get('/products').then(setItems);
    api.get('/categories').then(setCategories);
  }, []);
  useEffect(load, [load]);

  const remove = async (p) => {
    if (!confirm(`"${p.name}" ni o'chirasizmi?`)) return;
    await api.del(`/products/${p.id}`);
    showToast("O'chirildi (sotuvlarda bor bo'lsa — nofaol qilindi)");
    load();
  };

  const shown = items.filter(
    (p) => (!cat || String(p.categoryId) === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase()))
  );
  const stockCost = items.filter((p) => p.isActive).reduce((s, p) => s + Math.max(0, p.stock) * p.costPrice, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mahsulotlar va ombor</h1>
          <p>{items.length} ta mahsulot • ombor qiymati {money(stockCost)}</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setShowCats(true)}>🏷 Kategoriyalar</button>
          <button className="btn primary" onClick={() => setEditing({})}>+ Mahsulot</button>
        </div>
      </div>
      <div className="card">
        <div className="card-head">
          <div className="chips">
            <button className={`chip ${!cat ? 'active' : ''}`} onClick={() => setCat('')}>Hammasi</button>
            {categories.map((c) => (
              <button key={c.id} className={`chip ${cat === String(c.id) ? 'active' : ''}`} onClick={() => setCat(String(c.id))}>
                {c.name}
              </button>
            ))}
          </div>
          <input className="input" style={{ maxWidth: 220 }} placeholder="🔍 Qidirish" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nomi</th>
                <th className="hide-sm">Kategoriya</th>
                <th className="num hide-sm">Tannarx</th>
                <th className="num">Narx</th>
                <th className="num">Qoldiq</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const low = p.stock <= p.minStock;
                return (
                  <tr key={p.id} style={{ opacity: p.isActive ? 1 : 0.5 }}>
                    <td>
                      <b>{p.name}</b>
                      {!p.isActive && <span className="badge" style={{ marginLeft: 6 }}>nofaol</span>}
                      {p.sku && <div className="muted small">{p.sku}</div>}
                    </td>
                    <td className="hide-sm">{p.category?.name || <span className="muted">—</span>}</td>
                    <td className="num hide-sm">{money(p.costPrice)}</td>
                    <td className="num">{money(p.salePrice)}</td>
                    <td className="num">
                      <span className={`badge ${low ? 'red' : 'green'}`}>{num(p.stock)} {p.unit}</span>
                    </td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn sm" onClick={() => setStockItem(p)}>+ Kirim</button>{' '}
                      <button className="icon-btn" onClick={() => setEditing(p)} aria-label="Tahrirlash">✏️</button>
                      <button className="icon-btn" onClick={() => remove(p)} aria-label="O'chirish">🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!shown.length && <Empty>Mahsulot topilmadi</Empty>}
        </div>
      </div>
      {editing && (
        <ProductForm
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
      {stockItem && (
        <StockModal
          item={stockItem}
          onClose={() => setStockItem(null)}
          onSaved={() => {
            setStockItem(null);
            showToast('✅ Ombor yangilandi');
            load();
          }}
        />
      )}
      {showCats && <CategoryModal categories={categories} onClose={() => setShowCats(false)} onChanged={load} />}
      {toast}
    </>
  );
}
