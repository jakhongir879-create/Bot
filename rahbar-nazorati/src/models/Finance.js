const { prisma } = require('../database/connection');

const entries = {
  list(where = {}) {
    return prisma.financeEntry.findMany({ where, orderBy: [{ month: 'asc' }, { type: 'asc' }, { category: 'asc' }] });
  },
  upsert({ month, type, category, planAmount, factAmount }) {
    return prisma.financeEntry.upsert({
      where: { month_type_category: { month, type, category } },
      update: { planAmount, factAmount },
      create: { month, type, category, planAmount, factAmount },
    });
  },
  update(id, data) {
    return prisma.financeEntry.update({ where: { id: Number(id) }, data });
  },
  remove(id) {
    return prisma.financeEntry.delete({ where: { id: Number(id) } });
  },
};

const goals = {
  list() {
    return prisma.strategyGoal.findMany({ orderBy: { createdAt: 'asc' } });
  },
  create(data) {
    return prisma.strategyGoal.create({ data });
  },
  update(id, data) {
    return prisma.strategyGoal.update({ where: { id: Number(id) }, data });
  },
  remove(id) {
    return prisma.strategyGoal.delete({ where: { id: Number(id) } });
  },
};

const decisions = {
  list() {
    return prisma.tacticalDecision.findMany({ orderBy: { date: 'desc' } });
  },
  get(id) {
    return prisma.tacticalDecision.findUnique({ where: { id: Number(id) } });
  },
  create(data) {
    return prisma.tacticalDecision.create({ data });
  },
  update(id, data) {
    return prisma.tacticalDecision.update({ where: { id: Number(id) }, data });
  },
  remove(id) {
    return prisma.tacticalDecision.delete({ where: { id: Number(id) } });
  },
};

module.exports = { entries, goals, decisions };
