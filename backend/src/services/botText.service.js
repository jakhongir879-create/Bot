const config = require('../config/default');
const report = require('./report.service');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { resolveRange, formatKey } = require('../utils/date');
const { money, short, qty, changeText, escapeHtml: e } = require('../utils/format');

async function summaryText(period = 'today') {
  const range = resolveRange(period);
  const { summary: s, prevSummary: p } = await report.summary(range);
  const pays = report.byPayment(await report.loadPeriod(range)).filter((x) => x.count);

  const lines = [
    `📊 <b>${e(config.businessName)}</b>`,
    `🗓 <b>${e(range.label)}</b> (${formatKey(range.fromKey)}${range.fromKey !== range.toKey ? ' — ' + formatKey(range.toKey) : ''})`,
    '',
    `💰 Tushum: <b>${money(s.revenue)}</b>  ${changeText(s.revenue, p.revenue)}`,
    `🧾 Sotuvlar: <b>${s.salesCount} ta</b>  ${changeText(s.salesCount, p.salesCount)}`,
    `🛒 O'rtacha chek: <b>${money(s.avgCheck)}</b>`,
    `📦 Tannarx: ${money(s.costTotal)}`,
    `📈 Yalpi foyda: <b>${money(s.grossProfit)}</b> (marja ${s.margin}%)`,
    `💸 Xarajatlar: ${money(s.expenses)}  ${changeText(s.expenses, p.expenses)}`,
    `${s.netProfit >= 0 ? '✅' : '⚠️'} Sof foyda: <b>${money(s.netProfit)}</b>  ${changeText(s.netProfit, p.netProfit)}`,
  ];
  if (s.discount) lines.push(`🏷 Chegirmalar: ${money(s.discount)}`);
  if (s.newDebt) lines.push(`💳 Yangi nasiya: ${money(s.newDebt)}`);
  if (pays.length) {
    lines.push('', "<b>To'lov turlari:</b>");
    pays.forEach((x) => lines.push(` • ${x.label}: ${money(x.amount)} (${x.count} ta)`));
  }
  lines.push('', `<i>Foizlar oldingi teng davrga nisbatan.</i>`);
  return lines.join('\n');
}

async function chartText(days = 7) {
  const r = resolveRange(days === 30 ? 'days30' : 'week');
  const data = await report.loadPeriod(r);
  const series = report.dailySeries(r, data);
  const max = Math.max(...series.map((x) => x.revenue), 1);
  const width = 12;
  const lines = [`📈 <b>So'nggi ${series.length} kun tushumi</b>`, '<pre>'];
  for (const d of series) {
    const n = Math.round((d.revenue / max) * width);
    const bar = '█'.repeat(n) + '░'.repeat(width - n);
    lines.push(`${formatKey(d.date).slice(0, 5)} ${bar} ${short(d.revenue)}`);
  }
  lines.push('</pre>');
  const total = series.reduce((s, x) => s + x.revenue, 0);
  const net = series.reduce((s, x) => s + x.netProfit, 0);
  const best = series.reduce((a, b) => (b.revenue > a.revenue ? b : a), series[0]);
  lines.push(`Jami: <b>${money(total)}</b>`);
  lines.push(`Sof foyda: <b>${money(net)}</b>`);
  lines.push(`Kunlik o'rtacha: ${money(total / series.length)}`);
  if (best?.revenue) lines.push(`🥇 Eng yaxshi kun: ${formatKey(best.date)} — ${money(best.revenue)}`);
  return lines.join('\n');
}

async function topText(period = 'month') {
  const range = resolveRange(period);
  const top = report.topProducts(await report.loadPeriod(range), 10);
  if (!top.length) return `🏆 <b>Top mahsulotlar (${e(range.label)})</b>\n\nBu davrda sotuv yo'q.`;
  const medals = ['🥇', '🥈', '🥉'];
  const lines = [`🏆 <b>Top mahsulotlar (${e(range.label)})</b>`, ''];
  top.forEach((p, i) => {
    lines.push(`${medals[i] || `${i + 1}.`} <b>${e(p.name)}</b>`);
    lines.push(`    ${qty(p.quantity)} ta • ${money(p.revenue)} • foyda ${money(p.profit)}`);
  });
  return lines.join('\n');
}

async function stockText() {
  const products = await Product.list({ activeOnly: true });
  const value = await report.stockValue();
  if (!products.length) return "📦 Omborda mahsulot yo'q. Dashboard orqali mahsulot qo'shing.";
  const low = products.filter((p) => p.stock <= p.minStock);
  const lines = ['📦 <b>Ombor holati</b>', ''];
  if (low.length) {
    lines.push(`⚠️ <b>Kam qolgan (${low.length} ta):</b>`);
    low.forEach((p) => lines.push(` 🔴 ${e(p.name)} — ${qty(p.stock)} ${e(p.unit)} (min ${qty(p.minStock)})`));
    lines.push('');
  }
  lines.push('<b>Barcha mahsulotlar:</b>');
  products
    .filter((p) => p.stock > p.minStock)
    .forEach((p) => lines.push(` 🟢 ${e(p.name)} — ${qty(p.stock)} ${e(p.unit)}`));
  lines.push('', `💼 Ombor qiymati (tannarxda): <b>${money(value.cost)}</b>`);
  lines.push(`💵 Sotish narxida: <b>${money(value.sale)}</b>`);
  return lines.join('\n');
}

async function debtText() {
  const list = await Customer.debtors();
  if (!list.length) return "💳 Hozircha qarzdor mijozlar yo'q 👍";
  const total = list.reduce((s, c) => s + c.debt, 0);
  const lines = ['💳 <b>Qarzdor mijozlar</b>', ''];
  list.slice(0, 30).forEach((c, i) => {
    lines.push(`${i + 1}. <b>${e(c.name)}</b>${c.phone ? ` (${e(c.phone)})` : ''} — ${money(c.debt)}`);
  });
  lines.push('', `Jami qarz: <b>${money(total)}</b>`);
  return lines.join('\n');
}

async function dailyReportText() {
  const main = await summaryText('today');
  const low = await Product.lowStock();
  const top = report.topProducts(await report.loadPeriod(resolveRange('today')), 3);
  const extra = [];
  if (top.length) {
    extra.push('', '🏆 <b>Bugungi top-3:</b>');
    top.forEach((p, i) => extra.push(` ${i + 1}. ${e(p.name)} — ${qty(p.quantity)} ta`));
  }
  if (low.length) {
    extra.push('', `⚠️ <b>Omborda kam qolgan:</b> ${low.map((p) => e(p.name)).join(', ')}`);
  }
  return `🌙 <b>Kunlik avtomatik hisobot</b>\n\n${main}${extra.join('\n')}`;
}

module.exports = { summaryText, chartText, topText, stockText, debtText, dailyReportText };
