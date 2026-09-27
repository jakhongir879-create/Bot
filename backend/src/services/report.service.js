const prisma = require('../database/connection');
const config = require('../config/default');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { localKey, localHour, addDays, resolveRange, previousRange } = require('../utils/date');
const { change } = require('../utils/format');

async function loadPeriod(range) {
  const [sales, expenses] = await Promise.all([
    prisma.sale.findMany({
      where: { createdAt: { gte: range.from, lt: range.to } },
      include: { items: true },
    }),
    prisma.expense.findMany({ where: { date: { gte: range.from, lt: range.to } } }),
  ]);
  return { sales, expenses };
}

function summarize({ sales, expenses }) {
  const revenue = sales.reduce((s, x) => s + x.total, 0);
  const costTotal = sales.reduce((s, x) => s + x.costTotal, 0);
  const discount = sales.reduce((s, x) => s + x.discount, 0);
  const paid = sales.reduce((s, x) => s + x.paidAmount, 0);
  const grossProfit = revenue - costTotal;
  const expenseTotal = expenses.reduce((s, x) => s + x.amount, 0);
  const itemsSold = sales.reduce((s, x) => s + x.items.reduce((a, i) => a + i.quantity, 0), 0);
  const customers = new Set(sales.filter((s) => s.customerId).map((s) => s.customerId)).size;
  return {
    revenue,
    costTotal,
    grossProfit,
    expenses: expenseTotal,
    netProfit: grossProfit - expenseTotal,
    salesCount: sales.length,
    avgCheck: sales.length ? Math.round(revenue / sales.length) : 0,
    itemsSold,
    discount,
    paid,
    newDebt: revenue - paid,
    customers,
    margin: revenue ? Math.round((grossProfit / revenue) * 100) : 0,
  };
}

function dailySeries(range, { sales, expenses }) {
  const map = new Map();
  for (let k = range.fromKey; k <= range.toKey; k = addDays(k, 1)) {
    map.set(k, { date: k, revenue: 0, profit: 0, expenses: 0, salesCount: 0 });
  }
  for (const s of sales) {
    const row = map.get(localKey(s.createdAt));
    if (!row) continue;
    row.revenue += s.total;
    row.profit += s.profit;
    row.salesCount += 1;
  }
  for (const e of expenses) {
    const row = map.get(localKey(e.date));
    if (row) row.expenses += e.amount;
  }
  return [...map.values()].map((r) => ({ ...r, netProfit: r.profit - r.expenses }));
}

function topProducts({ sales }, limit = 10) {
  const map = new Map();
  for (const s of sales) {
    for (const it of s.items) {
      const key = it.productId || it.productName;
      const row = map.get(key) || { productId: it.productId, name: it.productName, quantity: 0, revenue: 0, profit: 0 };
      row.quantity += it.quantity;
      row.revenue += it.total;
      row.profit += it.total - Math.round(it.costPrice * it.quantity);
      map.set(key, row);
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

function byPayment({ sales }) {
  const out = Object.keys(config.paymentMethods).map((k) => ({
    method: k,
    label: config.paymentMethods[k],
    amount: 0,
    count: 0,
  }));
  for (const s of sales) {
    const row = out.find((o) => o.method === s.paymentMethod);
    row.amount += s.total;
    row.count += 1;
  }
  return out;
}

function expensesByCategory({ expenses }) {
  const map = new Map();
  for (const e of expenses) map.set(e.category, (map.get(e.category) || 0) + e.amount);
  return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

function hourly({ sales }) {
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, count: 0 }));
  for (const s of sales) {
    const h = hours[localHour(s.createdAt)];
    h.revenue += s.total;
    h.count += 1;
  }
  return hours;
}

async function debtTotal() {
  const agg = await prisma.sale.aggregate({ _sum: { total: true, paidAmount: true } });
  return (agg._sum.total || 0) - (agg._sum.paidAmount || 0);
}

async function stockValue() {
  const products = await prisma.product.findMany({ where: { isActive: true } });
  return {
    cost: Math.round(products.reduce((s, p) => s + Math.max(0, p.stock) * p.costPrice, 0)),
    sale: Math.round(products.reduce((s, p) => s + Math.max(0, p.stock) * p.salePrice, 0)),
    count: products.length,
  };
}

async function summary(range) {
  const prev = previousRange(range);
  const [cur, old] = await Promise.all([loadPeriod(range), loadPeriod(prev)]);
  const s = summarize(cur);
  const p = summarize(old);
  const changes = {};
  for (const k of Object.keys(s)) changes[k] = change(s[k], p[k]);
  return { range, prevRange: prev, summary: s, prevSummary: p, changes, data: cur };
}

async function overview(period, from, to) {
  const range = resolveRange(period, from, to);
  const base = await summary(range);
  const [lowStock, debt, stock, debtors, recentSales] = await Promise.all([
    Product.lowStock(),
    debtTotal(),
    stockValue(),
    Customer.debtors(),
    prisma.sale.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { customer: true, items: true },
    }),
  ]);
  return {
    range: { ...range, from: range.from.toISOString(), to: range.to.toISOString() },
    summary: base.summary,
    prevSummary: base.prevSummary,
    changes: base.changes,
    series: dailySeries(range, base.data),
    topProducts: topProducts(base.data),
    byPayment: byPayment(base.data),
    expensesByCategory: expensesByCategory(base.data),
    hourly: hourly(base.data),
    lowStock,
    debtTotal: debt,
    stockValue: stock,
    topDebtors: debtors.slice(0, 5),
    recentSales,
  };
}

module.exports = {
  loadPeriod,
  summarize,
  summary,
  overview,
  dailySeries,
  topProducts,
  byPayment,
  expensesByCategory,
  hourly,
  debtTotal,
  stockValue,
};
