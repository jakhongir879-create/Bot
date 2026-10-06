const { prisma } = require('../database/connection');
const { ACTIVE_STATUSES } = require('../models/Task');
const Finance = require('../models/Finance');
const { METRICS, REASON_LABELS } = require('../utils/labels');
const { DAY_MS, HOUR_MS, addDays, startOfWeek, startOfDay, endOfDay, monthKey, shiftMonth, formatDate, parts } = require('../utils/format');

const WEIGHTS = { onTime: 30, acceptSpeed: 20, completeSpeed: 20, quality: 20, returns: 10 };

const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const round1 = (v) => (v === null || v === undefined ? null : Math.round(v * 10) / 10);
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

function scoreStatus(score) {
  if (score === null || score === undefined) return { key: 'NOMA_LUM', label: "Ma'lumot yo'q", color: 'gray' };
  if (score >= 75) return { key: 'FAOL', label: 'Faol', color: 'green' };
  if (score >= 50) return { key: 'ORTACHA', label: "O'rtacha", color: 'yellow' };
  return { key: 'SUST', label: 'Sust', color: 'red' };
}

function isOverdue(task, now) {
  return ACTIVE_STATUSES.includes(task.status) && new Date(task.deadline) < now;
}

/**
 * Bitta xodimning vazifalari bo'yicha ko'rsatkichlar.
 * tasks — shu xodimga berilgan, tanlangan davrga tegishli vazifalar.
 */
function computeMetrics(tasks, now = new Date()) {
  const done = tasks.filter((t) => t.status === 'BAJARILDI' && t.completedAt);
  const failed = tasks.filter((t) => t.status === 'BAJARILMADI');
  const overdue = tasks.filter((t) => isOverdue(t, now));
  const active = tasks.filter((t) => ACTIVE_STATUSES.includes(t.status));

  // Har bir vazifa KPI og'irligi (1–5) bilan hisoblanadi: muhim vazifa ballga ko'proq ta'sir qiladi
  const w = (t) => t.kpiWeight || 3;
  const sumW = (list) => list.reduce((s, t) => s + w(t), 0);
  const due = done.length + failed.length + overdue.length;
  const onTimeDone = done.filter((t) => new Date(t.completedAt) <= new Date(t.deadline));
  const dueWeight = sumW(done) + sumW(failed) + sumW(overdue);
  const onTimeRate = dueWeight ? (sumW(onTimeDone) / dueWeight) * 100 : null;

  const acceptHours = tasks
    .filter((t) => t.acceptedAt)
    .map((t) => Math.max(0, (new Date(t.acceptedAt) - new Date(t.createdAt)) / HOUR_MS));
  const avgAcceptHours = avg(acceptHours);
  const acceptSpeedScore = avgAcceptHours === null ? null : clamp(100 - ((avgAcceptHours - 1) / 23) * 100);

  const avgRatio = done.length
    ? done.reduce((s, t) => {
        const planned = Math.max(HOUR_MS, new Date(t.deadline) - new Date(t.createdAt));
        return s + w(t) * ((new Date(t.completedAt) - new Date(t.createdAt)) / planned);
      }, 0) / sumW(done)
    : null;
  const completeSpeedScore = avgRatio === null ? null : clamp(100 - (avgRatio - 0.5) * 100);

  const lateDays = done
    .filter((t) => new Date(t.completedAt) > new Date(t.deadline))
    .map((t) => (new Date(t.completedAt) - new Date(t.deadline)) / DAY_MS);
  const overdueDays = overdue.map((t) => (now - new Date(t.deadline)) / DAY_MS);
  const allLate = [...lateDays, ...overdueDays];
  const avgDelayDays = allLate.length ? avg(allLate) : 0;

  const rated = done.filter((t) => t.qualityScore);
  const avgQuality = rated.length ? rated.reduce((s, t) => s + w(t) * t.qualityScore, 0) / sumW(rated) : null;
  const qualityScore = avgQuality === null ? null : (avgQuality / 5) * 100;

  const totalReturns = tasks.reduce((s, t) => s + (t.returnCount || 0), 0);
  const returnBase = done.length + tasks.filter((t) => t.returnCount > 0 && t.status !== 'BAJARILDI').length;
  const returnsScore = returnBase ? clamp(100 - (totalReturns / returnBase) * 200) : null;

  const components = {
    onTime: onTimeRate,
    acceptSpeed: acceptSpeedScore,
    completeSpeed: completeSpeedScore,
    quality: qualityScore,
    returns: returnsScore,
  };

  let weightSum = 0;
  let weighted = 0;
  for (const [key, value] of Object.entries(components)) {
    if (value === null || value === undefined) continue;
    weightSum += WEIGHTS[key];
    weighted += WEIGHTS[key] * value;
  }
  const hasEnough = due > 0 || acceptHours.length > 0;
  const score = weightSum && hasEnough ? Math.round(weighted / weightSum) : null;

  return {
    score,
    status: scoreStatus(score),
    total: tasks.length,
    active: active.length,
    done: done.length,
    failed: failed.length,
    overdue: overdue.length,
    onTimeRate: round1(onTimeRate),
    avgAcceptHours: round1(avgAcceptHours),
    avgDelayDays: round1(avgDelayDays),
    avgQuality: round1(avgQuality),
    returns: totalReturns,
    components: Object.fromEntries(Object.entries(components).map(([k, v]) => [k, round1(v)])),
  };
}

/** Davrga tegishli vazifalar: deadline yoki yaratilgan sana davr ichida */
function periodWhere(from, to) {
  return {
    OR: [
      { deadline: { gte: from, lte: to } },
      { createdAt: { gte: from, lte: to } },
    ],
  };
}

async function tasksInPeriod(from, to, extraWhere = {}) {
  return prisma.task.findMany({ where: { AND: [periodWhere(from, to), extraWhere] } });
}

async function employeeMetrics(employeeId, days = 30, now = new Date()) {
  const from = addDays(now, -days);
  const tasks = await tasksInPeriod(from, now, { assigneeId: employeeId });
  return computeMetrics(tasks, now);
}

/** Haftalik trend: har bir hafta uchun ball (dushanbadan boshlab) */
function weeklyScores(tasks, weeks = 8, now = new Date()) {
  const result = [];
  const thisWeek = startOfWeek(now);
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const from = addDays(thisWeek, -7 * i);
    const to = i === 0 ? now : new Date(addDays(from, 7).getTime() - 1);
    const inWeek = tasks.filter((t) => {
      const d = new Date(t.deadline);
      return d >= from && d <= to;
    });
    const m = computeMetrics(inWeek, to);
    result.push({ week: formatDate(from), from, score: m.score, tasks: inWeek.length });
  }
  return result;
}

function trendOf(weekly) {
  const current = weekly[weekly.length - 1]?.score ?? null;
  const previous = weekly[weekly.length - 2]?.score ?? null;
  if (current === null || previous === null) return { current, previous, delta: null, direction: 'flat' };
  const delta = current - previous;
  return { current, previous, delta, direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' };
}

async function employeeTrend(employeeId, weeks = 8, now = new Date()) {
  const from = addDays(startOfWeek(now), -7 * (weeks - 1));
  const tasks = await prisma.task.findMany({ where: { assigneeId: employeeId, deadline: { gte: from, lte: now } } });
  const weekly = weeklyScores(tasks, weeks, now);
  return { weekly, trend: trendOf(weekly) };
}

/** Barcha (yoki berilgan) xodimlar reytingi */
async function ranking({ days = 30, employeeIds = null, now = new Date() } = {}) {
  const where = { isActive: true, role: { in: ['TOP', 'MIDDLE'] } };
  if (employeeIds) where.id = { in: employeeIds };
  const employees = await prisma.employee.findMany({
    where,
    select: { id: true, fullName: true, position: true, department: true, role: true, managerId: true },
  });
  if (!employees.length) return [];
  const ids = employees.map((e) => e.id);
  const from = addDays(now, -days);
  const trendFrom = addDays(startOfWeek(now), -7);
  const [periodTasks, trendTasks] = await Promise.all([
    tasksInPeriod(from, now, { assigneeId: { in: ids } }),
    prisma.task.findMany({ where: { assigneeId: { in: ids }, deadline: { gte: trendFrom, lte: now } } }),
  ]);

  const rows = employees.map((emp) => {
    const own = periodTasks.filter((t) => t.assigneeId === emp.id);
    const metrics = computeMetrics(own, now);
    const weekly = weeklyScores(trendTasks.filter((t) => t.assigneeId === emp.id), 2, now);
    return { ...emp, ...metrics, trend: trendOf(weekly) };
  });

  rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

async function teamWeeklyTrend({ weeks = 8, now = new Date(), employeeIds = null } = {}) {
  const from = addDays(startOfWeek(now), -7 * (weeks - 1));
  const employees = await prisma.employee.findMany({
    where: { isActive: true, role: { in: ['TOP', 'MIDDLE'] }, ...(employeeIds ? { id: { in: employeeIds } } : {}) },
    select: { id: true, role: true },
  });
  const tasks = await prisma.task.findMany({
    where: { deadline: { gte: from, lte: now }, assigneeId: { in: employees.map((e) => e.id) } },
  });
  const roleOf = new Map(employees.map((e) => [e.id, e.role]));
  const all = weeklyScores(tasks, weeks, now);
  const top = weeklyScores(tasks.filter((t) => roleOf.get(t.assigneeId) === 'TOP'), weeks, now);
  const middle = weeklyScores(tasks.filter((t) => roleOf.get(t.assigneeId) === 'MIDDLE'), weeks, now);
  return all.map((w, i) => ({ week: w.week, umumiy: w.score, top: top[i].score, middle: middle[i].score }));
}

function roleComparison(rows) {
  const group = (role) => {
    const list = rows.filter((r) => r.role === role);
    const scored = list.filter((r) => r.score !== null);
    return {
      role,
      count: list.length,
      avgScore: round1(avg(scored.map((r) => r.score))),
      avgOnTime: round1(avg(list.filter((r) => r.onTimeRate !== null).map((r) => r.onTimeRate))),
      avgQuality: round1(avg(list.filter((r) => r.avgQuality !== null).map((r) => r.avgQuality))),
      avgAcceptHours: round1(avg(list.filter((r) => r.avgAcceptHours !== null).map((r) => r.avgAcceptHours))),
      overdue: list.reduce((s, r) => s + r.overdue, 0),
      returns: list.reduce((s, r) => s + r.returns, 0),
    };
  };
  return [group('TOP'), group('MIDDLE')];
}

/** Vazifalar bo'yicha umumiy statistika */
async function taskSummary({ from, to, where = {}, now = new Date() } = {}) {
  const tasks = await tasksInPeriod(from, to, where);
  const byStatus = {};
  for (const t of tasks) byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  const overdue = tasks.filter((t) => isOverdue(t, now));
  const done = tasks.filter((t) => t.status === 'BAJARILDI');
  const failed = tasks.filter((t) => t.status === 'BAJARILMADI');
  const due = done.length + failed.length + overdue.length;
  const onTime = done.filter((t) => t.completedAt && new Date(t.completedAt) <= new Date(t.deadline));

  const reasons = {};
  for (const t of tasks) {
    if (!t.failReason) continue;
    reasons[t.failReason] = (reasons[t.failReason] || 0) + 1;
  }
  return {
    total: tasks.length,
    byStatus,
    done: done.length,
    failed: failed.length,
    overdue: overdue.length,
    active: tasks.filter((t) => ACTIVE_STATUSES.includes(t.status)).length,
    completionRate: due ? round1((done.length / due) * 100) : null,
    onTimeRate: due ? round1((onTime.length / due) * 100) : null,
    reasons: Object.entries(reasons)
      .map(([key, count]) => ({ key, label: REASON_LABELS[key], count }))
      .sort((a, b) => b.count - a.count),
  };
}

async function currentOverdueTasks({ where = {}, take = 10, now = new Date() } = {}) {
  return prisma.task.findMany({
    where: { ...where, status: { in: ACTIVE_STATUSES }, deadline: { lt: now } },
    orderBy: { deadline: 'asc' },
    take,
    include: { assignee: { select: { fullName: true, department: true } }, assigner: { select: { fullName: true } } },
  });
}

async function mostDelayedTasks({ from, to, take = 10, now = new Date() }) {
  const tasks = await prisma.task.findMany({
    where: { AND: [periodWhere(from, to)] },
    include: { assignee: { select: { fullName: true, department: true } } },
  });
  return tasks
    .map((t) => {
      let delay = 0;
      if (t.completedAt && new Date(t.completedAt) > new Date(t.deadline)) delay = new Date(t.completedAt) - new Date(t.deadline);
      else if (isOverdue(t, now)) delay = now - new Date(t.deadline);
      return { ...t, delayDays: round1(delay / DAY_MS) };
    })
    .filter((t) => t.delayDays > 0)
    .sort((a, b) => b.delayDays - a.delayDays)
    .slice(0, take);
}

async function personalDashboard(employee, now = new Date()) {
  const todayEnd = endOfDay(now);
  const todayStart = startOfDay(now);
  const active = await prisma.task.findMany({
    where: { assigneeId: employee.id, status: { in: ACTIVE_STATUSES } },
    orderBy: { deadline: 'asc' },
    include: { assigner: { select: { id: true, fullName: true } } },
  });
  return {
    activeCount: active.length,
    todayCount: active.filter((t) => new Date(t.deadline) >= todayStart && new Date(t.deadline) <= todayEnd).length,
    overdueCount: active.filter((t) => new Date(t.deadline) < now).length,
    upcoming: active.slice(0, 8),
  };
}

/* ======================== MOLIYA ======================== */

function monthTotals(entries, month) {
  const list = entries.filter((e) => e.month === month);
  const sum = (type, field) => list.filter((e) => e.type === type).reduce((s, e) => s + e[field], 0);
  const revenuePlan = sum('TUSHUM', 'planAmount');
  const revenue = sum('TUSHUM', 'factAmount');
  const cogsPlan = sum('TANNARX', 'planAmount');
  const cogs = sum('TANNARX', 'factAmount');
  const expensesPlan = sum('XARAJAT', 'planAmount');
  const expenses = sum('XARAJAT', 'factAmount');
  const grossProfit = revenue - cogs;
  const netProfit = revenue - cogs - expenses;
  const netProfitPlan = revenuePlan - cogsPlan - expensesPlan;
  const categories = {};
  for (const e of list.filter((x) => x.type === 'XARAJAT')) {
    categories[e.category] = { plan: e.planAmount, fact: e.factAmount };
  }
  return {
    month,
    hasFact: list.some((e) => e.factAmount > 0),
    revenue,
    revenuePlan,
    cogs,
    cogsPlan,
    expenses,
    expensesPlan,
    grossProfit,
    netProfit,
    netProfitPlan,
    grossMargin: revenue ? round1((grossProfit / revenue) * 100) : null,
    netMargin: revenue ? round1((netProfit / revenue) * 100) : null,
    expenseShare: revenue ? round1((expenses / revenue) * 100) : null,
    cogsShare: revenue ? round1((cogs / revenue) * 100) : null,
    planExecution: revenuePlan ? round1((revenue / revenuePlan) * 100) : null,
    expensePlanExecution: expensesPlan ? round1((expenses / expensesPlan) * 100) : null,
    categories,
  };
}

async function financeMonths(count = 12) {
  const entries = await Finance.entries.list();
  const months = [...new Set(entries.map((e) => e.month))].sort();
  const selected = months.slice(-count);
  const rows = selected.map((m) => monthTotals(entries, m));
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    row.revenueGrowth = prev && prev.revenue ? round1(((row.revenue - prev.revenue) / prev.revenue) * 100) : null;
  });
  return rows;
}

function metricValue(row, metric, category) {
  if (!row) return null;
  switch (metric) {
    case 'SOF_MARJA':
      return row.netMargin;
    case 'YALPI_MARJA':
      return row.grossMargin;
    case 'TUSHUM_OSISHI':
      return row.revenueGrowth;
    case 'XARAJAT_ULUSHI':
      return row.expenseShare;
    case 'TANNARX_ULUSHI':
      return row.cogsShare;
    case 'REJA_BAJARILISHI':
      return row.planExecution;
    case 'TOIFA_ULUSHI': {
      const c = row.categories[category];
      return c && row.revenue ? round1((c.fact / row.revenue) * 100) : null;
    }
    case 'TUSHUM':
      return row.revenue;
    case 'SOF_FOYDA':
      return row.netProfit;
    default:
      return null;
  }
}

function averageMetric(rows, metric, category) {
  const values = rows.map((r) => metricValue(r, metric, category)).filter((v) => v !== null && v !== undefined);
  return values.length ? round1(avg(values)) : null;
}

function evaluateGoal(goal, rows) {
  const factRows = rows.filter((r) => r.hasFact).slice(-3);
  const value = averageMetric(factRows, goal.metric, goal.category);
  const latest = metricValue(factRows[factRows.length - 1], goal.metric, goal.category);
  let status = 'NOMA_LUM';
  if (value !== null) {
    const target = goal.targetValue;
    const tolerance = Math.max(Math.abs(target) * 0.1, 1);
    if (goal.condition === 'GTE') {
      status = value >= target ? 'BAJARILDI' : value >= target - tolerance ? 'XAVF_OSTIDA' : 'BAJARILMADI';
    } else {
      status = value <= target ? 'BAJARILDI' : value <= target + tolerance ? 'XAVF_OSTIDA' : 'BAJARILMADI';
    }
  }
  const labels = {
    BAJARILDI: 'Bajarildi',
    XAVF_OSTIDA: 'Xavf ostida',
    BAJARILMADI: 'Bajarilmadi',
    NOMA_LUM: "Ma'lumot yetarli emas",
  };
  return {
    ...goal,
    metricLabel: METRICS[goal.metric]?.label || goal.metric,
    unit: METRICS[goal.metric]?.unit || '',
    currentValue: value,
    latestValue: latest,
    basis: factRows.map((r) => r.month),
    status,
    statusLabel: labels[status],
  };
}

function evaluateDecision(decision, rows) {
  const decisionMonth = monthKey(decision.date);
  const beforeMonths = [shiftMonth(decisionMonth, -2), shiftMonth(decisionMonth, -1)];
  const afterMonths = [shiftMonth(decisionMonth, 1), shiftMonth(decisionMonth, 2)];
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const beforeRows = beforeMonths.map((m) => byMonth.get(m)).filter((r) => r && r.hasFact);
  const afterRows = afterMonths.map((m) => byMonth.get(m)).filter((r) => r && r.hasFact);
  const before = averageMetric(beforeRows, decision.metric, decision.category);
  const after = averageMetric(afterRows, decision.metric, decision.category);
  const meta = METRICS[decision.metric] || { better: 'up', label: decision.metric, unit: '' };

  let autoVerdict = 'HALI_ERTA';
  let change = null;
  if (before !== null && after !== null && afterRows.length >= 2) {
    change = round1(after - before);
    const improved = meta.better === 'up' ? after > before : after < before;
    autoVerdict = improved ? 'OZINI_OQLADI' : 'OQLAMADI';
  } else if (before !== null && after !== null) {
    change = round1(after - before);
  }
  return {
    ...decision,
    metricLabel: meta.label,
    unit: meta.unit,
    better: meta.better,
    beforeMonths,
    afterMonths,
    before,
    after,
    change,
    autoVerdict,
  };
}

async function financeOverview() {
  const rows = await financeMonths(24);
  const [goals, decisions] = await Promise.all([Finance.goals.list(), Finance.decisions.list()]);
  const factRows = rows.filter((r) => r.hasFact);
  const current = factRows[factRows.length - 1] || null;

  const structure = {};
  for (const row of factRows.slice(-3)) {
    for (const [cat, v] of Object.entries(row.categories)) {
      structure[cat] = (structure[cat] || 0) + v.fact;
    }
  }
  return {
    months: rows,
    current,
    expenseStructure: Object.entries(structure)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    goals: goals.map((g) => evaluateGoal(g, rows)),
    decisions: decisions.map((d) => evaluateDecision(d, rows)),
  };
}

/* ======================== SKLAD ======================== */

async function stockAnalytics() {
  const checks = await prisma.stockCheck.findMany({ orderBy: { checkDate: 'desc' } });
  const items = await prisma.stockCheckItem.findMany({
    where: { NOT: { diffQty: 0 } },
    include: { stockCheck: { select: { id: true, checkDate: true, responsible: true, warehouse: true } } },
  });

  const byResponsible = {};
  for (const item of items) {
    const name = item.responsible || item.stockCheck.responsible || "Noma'lum";
    if (!byResponsible[name]) byResponsible[name] = { responsible: name, shortage: 0, surplus: 0, items: 0, checks: new Set() };
    const r = byResponsible[name];
    if (item.diffSum < 0) r.shortage += item.diffSum;
    else r.surplus += item.diffSum;
    r.items += 1;
    r.checks.add(item.stockCheckId);
  }

  const byProduct = {};
  for (const item of items) {
    const key = item.code || item.name;
    if (!byProduct[key]) byProduct[key] = { code: item.code, name: item.name, checks: new Set(), totalDiffSum: 0, totalDiffQty: 0, responsibles: new Set() };
    const p = byProduct[key];
    p.checks.add(item.stockCheckId);
    p.totalDiffSum += item.diffSum;
    p.totalDiffQty += item.diffQty;
    p.responsibles.add(item.responsible || item.stockCheck.responsible);
  }

  return {
    checks,
    byResponsible: Object.values(byResponsible)
      .map((r) => ({ ...r, total: r.shortage + r.surplus, checks: r.checks.size }))
      .sort((a, b) => a.shortage - b.shortage),
    repeated: Object.values(byProduct)
      .map((p) => ({ ...p, checks: p.checks.size, responsibles: [...p.responsibles].filter(Boolean) }))
      .filter((p) => p.checks > 1)
      .sort((a, b) => b.checks - a.checks || a.totalDiffSum - b.totalDiffSum),
  };
}

/* ======================== UMUMIY ======================== */

async function overview(now = new Date()) {
  const from = addDays(now, -30);
  const [tasks, rows, lastCheck, finance] = await Promise.all([
    taskSummary({ from, to: now, now }),
    ranking({ days: 30, now }),
    prisma.stockCheck.findFirst({ orderBy: { checkDate: 'desc' } }),
    financeOverview(),
  ]);
  const overdueNow = await prisma.task.count({ where: { status: { in: ACTIVE_STATUSES }, deadline: { lt: now } } });
  const scored = rows.filter((r) => r.score !== null);
  return {
    tasks: { ...tasks, overdueNow },
    avgScore: round1(avg(scored.map((r) => r.score))),
    statusCounts: {
      faol: rows.filter((r) => r.status.key === 'FAOL').length,
      ortacha: rows.filter((r) => r.status.key === 'ORTACHA').length,
      sust: rows.filter((r) => r.status.key === 'SUST').length,
    },
    topEmployees: scored.slice(0, 3),
    weakEmployees: scored.slice(-3).reverse(),
    lastStockCheck: lastCheck,
    finance: {
      current: finance.current,
      goals: finance.goals.map((g) => ({ name: g.name, status: g.status, statusLabel: g.statusLabel })),
      trend: finance.months.slice(-6).map((m) => ({ month: m.month, revenue: m.hasFact ? m.revenue : null, revenuePlan: m.revenuePlan, netProfit: m.netProfit })),
    },
  };
}

function periodLabel(from, to) {
  return `${formatDate(from)} – ${formatDate(to)}`;
}

function currentMonthRange(now = new Date()) {
  const p = parts(now);
  const from = startOfDay(new Date(Date.UTC(p.year, p.month - 1, 1, 12)));
  return { from, to: now };
}

module.exports = {
  WEIGHTS,
  scoreStatus,
  computeMetrics,
  employeeMetrics,
  employeeTrend,
  weeklyScores,
  trendOf,
  ranking,
  teamWeeklyTrend,
  roleComparison,
  taskSummary,
  currentOverdueTasks,
  mostDelayedTasks,
  personalDashboard,
  financeMonths,
  financeOverview,
  evaluateGoal,
  evaluateDecision,
  metricValue,
  stockAnalytics,
  overview,
  periodLabel,
  currentMonthRange,
};
