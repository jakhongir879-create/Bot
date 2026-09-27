const prisma = require('../database/connection');

const FIELDS = ['name', 'sku', 'unit', 'costPrice', 'salePrice', 'stock', 'minStock', 'isActive', 'categoryId'];

function clean(data) {
  const out = {};
  for (const k of FIELDS) {
    if (data[k] === undefined) continue;
    let v = data[k];
    if (['costPrice', 'salePrice'].includes(k)) v = Math.round(Number(v) || 0);
    if (['stock', 'minStock'].includes(k)) v = Number(v) || 0;
    if (k === 'categoryId') v = v ? Number(v) : null;
    if (k === 'isActive') v = Boolean(v);
    if (['name', 'sku', 'unit'].includes(k)) v = v == null ? null : String(v).trim();
    out[k] = v;
  }
  return out;
}

const Product = {
  list({ activeOnly = false } = {}) {
    return prisma.product.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { category: true },
    });
  },

  find(id) {
    return prisma.product.findUnique({ where: { id: Number(id) } });
  },

  create(data) {
    return prisma.product.create({ data: clean(data), include: { category: true } });
  },

  update(id, data) {
    return prisma.product.update({ where: { id: Number(id) }, data: clean(data), include: { category: true } });
  },

  async remove(id) {
    // Sotuvlarda ishlatilgan bo'lsa o'chirmaymiz, faqat nofaol qilamiz
    const used = await prisma.saleItem.count({ where: { productId: Number(id) } });
    if (used) {
      return prisma.product.update({ where: { id: Number(id) }, data: { isActive: false } });
    }
    return prisma.product.delete({ where: { id: Number(id) } });
  },

  async lowStock() {
    const all = await prisma.product.findMany({ where: { isActive: true }, orderBy: { stock: 'asc' } });
    return all.filter((p) => p.stock <= p.minStock);
  },
};

module.exports = Product;
