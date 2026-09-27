const prisma = require('../database/connection');

const Customer = {
  async list() {
    const [customers, stats] = await Promise.all([
      prisma.customer.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.sale.groupBy({
        by: ['customerId'],
        where: { customerId: { not: null } },
        _sum: { total: true, paidAmount: true },
        _count: { _all: true },
      }),
    ]);
    const map = new Map(stats.map((s) => [s.customerId, s]));
    return customers.map((c) => {
      const s = map.get(c.id);
      const total = s?._sum.total || 0;
      const paid = s?._sum.paidAmount || 0;
      return { ...c, salesCount: s?._count._all || 0, totalSpent: total, debt: Math.max(0, total - paid) };
    });
  },

  async debtors() {
    const list = await this.list();
    return list.filter((c) => c.debt > 0).sort((a, b) => b.debt - a.debt);
  },

  create({ name, phone, note }) {
    return prisma.customer.create({
      data: { name: String(name).trim(), phone: phone || null, note: note || null },
    });
  },

  async findOrCreate({ name, phone }) {
    if (phone) {
      const found = await prisma.customer.findFirst({ where: { phone } });
      if (found) return found;
    }
    const byName = await prisma.customer.findFirst({
      where: { name: { equals: String(name).trim(), mode: 'insensitive' } },
    });
    if (byName) return byName;
    return this.create({ name, phone });
  },

  update(id, { name, phone, note }) {
    return prisma.customer.update({
      where: { id: Number(id) },
      data: { name, phone: phone || null, note: note || null },
    });
  },

  remove(id) {
    return prisma.customer.delete({ where: { id: Number(id) } });
  },
};

module.exports = Customer;
