const prisma = require('../database/connection');
const { AppError } = require('../utils/errors');

function clean({ category, amount, note, date }) {
  const data = {};
  if (category !== undefined) data.category = String(category).trim() || 'Boshqa';
  if (amount !== undefined) {
    data.amount = Math.round(Number(amount) || 0);
    if (data.amount <= 0) throw new AppError("Summa noto'g'ri");
  }
  if (note !== undefined) data.note = note || null;
  if (date) data.date = new Date(date);
  return data;
}

const Expense = {
  list({ from, to } = {}) {
    return prisma.expense.findMany({
      where: from || to ? { date: { gte: from, lt: to } } : undefined,
      orderBy: { date: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });
  },
  create(data, createdById) {
    return prisma.expense.create({ data: { ...clean(data), createdById: createdById || null } });
  },
  update(id, data) {
    return prisma.expense.update({ where: { id: Number(id) }, data: clean(data) });
  },
  remove(id) {
    return prisma.expense.delete({ where: { id: Number(id) } });
  },
};

module.exports = Expense;
