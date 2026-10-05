const { prisma } = require('../database/connection');
const analytics = require('./analytics.service');
const ai = require('./ai.service');
const Employee = require('../models/Employee');
const Task = require('../models/Task');
const { REASON_LABELS } = require('../utils/labels');
const { escapeHtml, formatDate, formatDateTime, formatMoney, endOfDay, parts, DAY_MS } = require('../utils/format');

const DAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];

const BRIEF_SYSTEM = `${ai.BASE_SYSTEM}

Bu safar uch qismli format SHART EMAS. Senga rahbarning bugungi holati bo'yicha signallar beriladi.
Faqat "🎯 Bugungi 3 ta ustuvor ish" sarlavhasi bilan aynan 3 ta qisqa band yoz: har birida kim, nima qilishi kerak.
Jami 80 so'zdan oshmasin. Faqat berilgan ma'lumotga tayan.`;

async function collectSignals(employee, now = new Date()) {
  const isDirector = employee.role === 'DIRECTOR';
  const teamIds = isDirector ? null : await Employee.getSubordinateIds(employee.id);
  const scope = teamIds ? { assigneeId: { in: teamIds } } : {};
  const include = { assignee: { select: { fullName: true } } };

  const [dueToday, overdue, waitingRating, failedRecent, rows] = await Promise.all([
    prisma.task.findMany({
      where: { ...scope, status: { in: Task.ACTIVE_STATUSES }, deadline: { gte: now, lte: endOfDay(now) } },
      include,
      orderBy: { deadline: 'asc' },
    }),
    prisma.task.findMany({
      where: { ...scope, status: { in: Task.ACTIVE_STATUSES }, deadline: { lt: now } },
      include,
      orderBy: { deadline: 'desc' },
    }),
    prisma.task.count({ where: { assignerId: employee.id, status: 'BAJARILDI', qualityScore: null } }),
    prisma.task.findMany({
      where: { ...scope, status: 'BAJARILMADI', updatedAt: { gte: new Date(now.getTime() - DAY_MS) } },
      include,
    }),
    teamIds && !teamIds.length ? [] : analytics.ranking({ days: 30, employeeIds: teamIds, now }),
  ]);

  const drops = rows
    .filter((r) => r.trend.delta !== null && r.trend.delta <= -15)
    .map((r) => ({ name: r.fullName, from: r.trend.previous, to: r.trend.current }));
  const weak = rows.filter((r) => r.status.key === 'SUST').map((r) => ({ name: r.fullName, score: r.score }));

  let repeatedStock = [];
  let goalsAtRisk = [];
  if (isDirector) {
    const lastCheck = await prisma.stockCheck.findFirst({ orderBy: { checkDate: 'desc' } });
    if (lastCheck && now - lastCheck.checkDate < 60 * DAY_MS) {
      const stock = await analytics.stockAnalytics();
      repeatedStock = stock.repeated.filter((p) => p.totalDiffSum < 0).slice(0, 3);
    }
    const finance = await analytics.financeOverview();
    goalsAtRisk = finance.goals.filter((g) => g.status === 'XAVF_OSTIDA' || g.status === 'BAJARILMADI');
  }

  return {
    isDirector,
    dueToday,
    overdue,
    newOverdue: overdue.filter((t) => now - t.deadline < DAY_MS).length,
    waitingRating,
    failedRecent,
    drops,
    weak,
    repeatedStock,
    goalsAtRisk,
  };
}

function hhmm(date) {
  return formatDateTime(date).slice(11);
}

function renderSignals(employee, s, now = new Date()) {
  const p = parts(now);
  const lines = [`☀️ <b>Xayrli tong, ${escapeHtml(employee.fullName)}!</b>`, `${formatDate(now)}, ${DAYS[p.weekday]}${s.isDirector ? '' : ' · jamoangiz holati'}`, ''];
  let issues = 0;

  if (s.dueToday.length) {
    issues += 1;
    lines.push(`📌 <b>Bugun muddati tugaydi: ${s.dueToday.length} ta</b>`);
    s.dueToday.slice(0, 5).forEach((t) => lines.push(`• ${escapeHtml(t.title)} — ${escapeHtml(t.assignee.fullName)} (${hhmm(t.deadline)})`));
    if (s.dueToday.length > 5) lines.push(`  …yana ${s.dueToday.length - 5} ta`);
    lines.push('');
  }
  if (s.overdue.length) {
    issues += 1;
    lines.push(`🚨 <b>Muddati o'tgan: ${s.overdue.length} ta</b>${s.newOverdue ? ` (oxirgi sutkada +${s.newOverdue})` : ''}`);
    s.overdue.slice(0, 3).forEach((t) => lines.push(`• ${escapeHtml(t.title)} — ${escapeHtml(t.assignee.fullName)}`));
    lines.push('');
  }
  if (s.failedRecent.length) {
    issues += 1;
    lines.push(`❌ <b>Oxirgi sutkada bajarilmadi: ${s.failedRecent.length} ta</b>`);
    s.failedRecent.slice(0, 3).forEach((t) => lines.push(`• ${escapeHtml(t.title)} — ${escapeHtml(t.assignee.fullName)}${t.failReason ? ` (${REASON_LABELS[t.failReason]})` : ''}`));
    lines.push('');
  }
  if (s.waitingRating) {
    issues += 1;
    lines.push(`⭐ <b>Siz baholashingizni kutyapti: ${s.waitingRating} ta vazifa</b>`, '');
  }
  if (s.drops.length) {
    issues += 1;
    lines.push('📉 <b>Bali keskin tushganlar:</b>');
    s.drops.slice(0, 4).forEach((d) => lines.push(`• ${escapeHtml(d.name)}: ${d.from} → ${d.to}`));
    lines.push('');
  }
  if (s.weak.length) {
    issues += 1;
    lines.push(`🔴 <b>Sust holatdagi xodimlar: ${s.weak.length} ta</b>`);
    lines.push(`• ${s.weak.slice(0, 5).map((w) => `${escapeHtml(w.name)} (${w.score})`).join(', ')}`, '');
  }
  if (s.repeatedStock.length) {
    issues += 1;
    lines.push('📦 <b>Skladda takroriy kamomad:</b>');
    s.repeatedStock.forEach((r) => lines.push(`• ${escapeHtml(r.name)} — ${r.checks} marta, jami ${formatMoney(r.totalDiffSum)}`));
    lines.push('');
  }
  if (s.goalsAtRisk.length) {
    issues += 1;
    lines.push(`🎯 <b>Strategik maqsadlar: ${s.goalsAtRisk.length} tasi xavf ostida yoki bajarilmayapti</b>`);
    s.goalsAtRisk.slice(0, 3).forEach((g) => lines.push(`• ${escapeHtml(g.name)} — ${g.statusLabel}`));
    lines.push('');
  }
  if (!issues) lines.push("✅ Bugun shoshilinch muammo yo'q. Jamoa rejadagidek ishlayapti.", '');
  return lines;
}

function signalsForAi(s) {
  return {
    bugun_tugaydi: s.dueToday.slice(0, 8).map((t) => ({ vazifa: t.title, ijrochi: t.assignee.fullName, soat: hhmm(t.deadline) })),
    muddati_otgan: s.overdue.slice(0, 8).map((t) => ({ vazifa: t.title, ijrochi: t.assignee.fullName })),
    bajarilmadi_sutkada: s.failedRecent.map((t) => ({ vazifa: t.title, ijrochi: t.assignee.fullName, sabab: t.failReason ? REASON_LABELS[t.failReason] : null })),
    baholanmagan: s.waitingRating,
    bali_tushganlar: s.drops,
    sust_xodimlar: s.weak,
    takroriy_kamomad: s.repeatedStock.map((r) => ({ tovar: r.name, marta: r.checks, summa: formatMoney(r.totalDiffSum) })),
    xavfdagi_maqsadlar: s.goalsAtRisk.map((g) => ({ maqsad: g.name, holat: g.statusLabel })),
  };
}

/** Rahbar uchun ertalabki brifing matnini (HTML) tayyorlaydi */
async function build(employee, now = new Date()) {
  const signals = await collectSignals(employee, now);
  const lines = renderSignals(employee, signals, now);
  if (ai.isEnabled()) {
    try {
      const text = await ai.callClaude(BRIEF_SYSTEM, `Rahbar: ${employee.fullName}\nSignallar (JSON):\n${JSON.stringify(signalsForAi(signals), null, 1)}`);
      lines.push(escapeHtml(text.replace(/\*\*/g, '')).replace(/^(🎯[^\n]*)/, '<b>$1</b>'), '');
    } catch (error) {
      console.error('[BRIEF] AI qismi tayyorlanmadi:', error.message);
    }
  }
  lines.push("💬 Biror ishni bajarishim kerak bo'lsa, shunchaki yozing.");
  return lines.join('\n');
}

module.exports = { build, collectSignals };
