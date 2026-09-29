const { prisma } = require('../database/connection');

function save({ module, period, text, question }) {
  return prisma.aiReport.create({ data: { module, period, text, question: question || null } });
}

function list({ module, from, to, take = 100 } = {}) {
  const where = {};
  if (module) where.module = module;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }
  return prisma.aiReport.findMany({ where, orderBy: { createdAt: 'desc' }, take });
}

function latest(module) {
  return prisma.aiReport.findFirst({ where: { module, question: null }, orderBy: { createdAt: 'desc' } });
}

function remove(id) {
  return prisma.aiReport.delete({ where: { id: Number(id) } });
}

module.exports = { save, list, latest, remove };
