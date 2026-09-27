const prisma = require('../database/connection');
const { AppError } = require('../utils/errors');

const PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER', 'DEBT'];
const include = {
  items: true,
  customer: true,
  createdBy: { select: { id: true, name: true } },
};

const Sale = {
  async list({ from, to, onlyDebt = false, page = 1, limit = 50 } = {}) {
    const where = {};
    if (from || to) where.createdAt = { gte: from, lt: to };
    let sales = await prisma.sale.findMany({ where, include, orderBy: { createdAt: 'desc' } });
    if (onlyDebt) sales = sales.filter((s) => s.paidAmount < s.total);
    const total = sales.length;
    const start = (Math.max(1, page) - 1) * limit;
    return { total, page, limit, items: sales.slice(start, start + limit) };
  },

  find(id) {
    return prisma.sale.findUnique({ where: { id: Number(id) }, include });
  },

  /**
   * items: [{ productId, quantity, price? }]
   * paymentMethod: CASH | CARD | TRANSFER | DEBT
   */
  async create({ items, discount = 0, paymentMethod = 'CASH', paidAmount, customerId, note, createdById, allowNegativeStock = false }) {
    if (!Array.isArray(items) || !items.length) throw new AppError("Kamida bitta mahsulot tanlang");
    if (!PAYMENT_METHODS.includes(paymentMethod)) throw new AppError("To'lov turi noto'g'ri");

    return prisma.$transaction(async (tx) => {
      const ids = [...new Set(items.map((i) => Number(i.productId)))];
      const products = await tx.product.findMany({ where: { id: { in: ids } } });
      const byId = new Map(products.map((p) => [p.id, p]));

      const need = new Map();
      const lines = items.map((i) => {
        const p = byId.get(Number(i.productId));
        if (!p) throw new AppError('Mahsulot topilmadi');
        const quantity = Number(i.quantity);
        if (!(quantity > 0)) throw new AppError(`"${p.name}" uchun miqdor noto'g'ri`);
        const price = i.price != null && i.price !== '' ? Math.round(Number(i.price)) : p.salePrice;
        need.set(p.id, (need.get(p.id) || 0) + quantity);
        return {
          productId: p.id,
          productName: p.name,
          quantity,
          price,
          costPrice: p.costPrice,
          total: Math.round(price * quantity),
        };
      });

      if (!allowNegativeStock) {
        for (const [id, q] of need) {
          const p = byId.get(id);
          if (p.stock < q) {
            throw new AppError(`"${p.name}" omborda yetarli emas (qoldiq: ${p.stock} ${p.unit})`);
          }
        }
      }

      const subtotal = lines.reduce((s, l) => s + l.total, 0);
      const disc = Math.min(Math.max(0, Math.round(Number(discount) || 0)), subtotal);
      const total = subtotal - disc;
      const costTotal = lines.reduce((s, l) => s + Math.round(l.costPrice * l.quantity), 0);
      let paid = paymentMethod === 'DEBT' ? Math.round(Number(paidAmount) || 0) : total;
      paid = Math.min(Math.max(0, paid), total);

      if (paymentMethod === 'DEBT' && !customerId) {
        throw new AppError('Nasiya savdo uchun mijozni tanlang');
      }

      for (const [id, q] of need) {
        await tx.product.update({ where: { id }, data: { stock: { decrement: q } } });
      }

      return tx.sale.create({
        data: {
          customerId: customerId ? Number(customerId) : null,
          subtotal,
          discount: disc,
          total,
          costTotal,
          profit: total - costTotal,
          paidAmount: paid,
          paymentMethod,
          note: note || null,
          createdById: createdById || null,
          items: { create: lines },
        },
        include,
      });
    });
  },

  async pay(id, amount) {
    const sale = await this.find(id);
    if (!sale) throw new AppError('Sotuv topilmadi', 404);
    const left = sale.total - sale.paidAmount;
    const value = Math.round(Number(amount) || 0);
    if (value <= 0) throw new AppError("Summa noto'g'ri");
    return prisma.sale.update({
      where: { id: sale.id },
      data: { paidAmount: sale.paidAmount + Math.min(value, left) },
      include,
    });
  },

  // O'chirilganda mahsulotlar omborga qaytariladi
  async remove(id) {
    return prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id: Number(id) }, include: { items: true } });
      if (!sale) throw new AppError('Sotuv topilmadi', 404);
      for (const it of sale.items) {
        if (it.productId) {
          await tx.product.updateMany({ where: { id: it.productId }, data: { stock: { increment: it.quantity } } });
        }
      }
      return tx.sale.delete({ where: { id: sale.id } });
    });
  },
};

module.exports = Sale;
