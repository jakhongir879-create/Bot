const { prisma } = require('../database/connection');

function createWithItems({ checkDate, warehouse, responsible, fileName, items }) {
  const totals = items.reduce(
    (acc, item) => {
      if (item.diffSum < 0) acc.shortage += item.diffSum;
      else acc.surplus += item.diffSum;
      return acc;
    },
    { shortage: 0, surplus: 0 },
  );
  return prisma.stockCheck.create({
    data: {
      checkDate,
      warehouse,
      responsible,
      fileName,
      totalDiff: totals.shortage + totals.surplus,
      shortageSum: totals.shortage,
      surplusSum: totals.surplus,
      itemCount: items.length,
      items: { create: items },
    },
  });
}

function list() {
  return prisma.stockCheck.findMany({ orderBy: { checkDate: 'desc' } });
}

function getWithItems(id) {
  return prisma.stockCheck.findUnique({
    where: { id: Number(id) },
    include: { items: { orderBy: { diffSum: 'asc' } } },
  });
}

function latest() {
  return prisma.stockCheck.findFirst({ orderBy: { checkDate: 'desc' } });
}

function remove(id) {
  return prisma.stockCheck.delete({ where: { id: Number(id) } });
}

function allItemsWithDiff() {
  return prisma.stockCheckItem.findMany({
    where: { NOT: { diffQty: 0 } },
    include: { stockCheck: { select: { id: true, checkDate: true, warehouse: true, responsible: true } } },
  });
}

module.exports = { createWithItems, list, getWithItems, latest, remove, allItemsWithDiff };
