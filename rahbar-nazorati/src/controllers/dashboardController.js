const { prisma } = require('../database/connection');
const Employee = require('../models/Employee');
const Task = require('../models/Task');
const StockCheck = require('../models/StockCheck');
const Finance = require('../models/Finance');
const AiReport = require('../models/AiReport');
const analytics = require('../services/analytics.service');
const stockService = require('../services/stock.service');
const ai = require('../services/ai.service');
const { METRICS, EXPENSE_CATEGORIES, ROLE_LABELS } = require('../utils/labels');
const { normalizePhone, startOfDay, endOfDay, tashkentDate } = require('../utils/format');

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const ROLES = ['DIRECTOR', 'TOP', 'MIDDLE'];
const FINANCE_TYPES = ['TUSHUM', 'TANNARX', 'XARAJAT'];
const MODULES = ['VAZIFALAR', 'FAOLLIK', 'SKLAD', 'MOLIYA', 'UMUMIY'];

function parseDay(value, end = false) {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = tashkentDate(Number(m[1]), Number(m[2]), Number(m[3]));
  return end ? endOfDay(d) : startOfDay(d);
}

function requireText(value, field, max = 200) {
  const text = String(value ?? '').trim();
  if (!text) throw new ValidationError(`${field} kiritilmagan`);
  return text.slice(0, max);
}

function toAmount(value) {
  const n = Number(String(value ?? 0).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw new ValidationError("Summa noto'g'ri");
  return Math.round(n);
}

function validMonth(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''))) throw new ValidationError("Oy noto'g'ri (YYYY-MM)");
  return value;
}

/* ======================== Bosh sahifa ======================== */

async function overview(req, res) {
  const [data, report] = await Promise.all([analytics.overview(), AiReport.latest('UMUMIY')]);
  res.json({ ...data, aiSummary: report, aiEnabled: ai.isEnabled() });
}

/* ======================== Vazifalar ======================== */

async function tasks(req, res) {
  const { employeeId, department, status, from, to } = req.query;
  const now = new Date();
  const where = { AND: [] };
  if (employeeId) where.AND.push({ assigneeId: Number(employeeId) });
  if (department) where.AND.push({ assignee: { department } });
  if (status === 'MUDDATI_OTGAN') where.AND.push({ status: { in: Task.ACTIVE_STATUSES }, deadline: { lt: now } });
  else if (status) where.AND.push({ status });
  const fromDate = parseDay(from);
  const toDate = parseDay(to, true);
  if (fromDate || toDate) {
    const range = {};
    if (fromDate) range.gte = fromDate;
    if (toDate) range.lte = toDate;
    where.AND.push({ OR: [{ deadline: range }, { createdAt: range }] });
  }
  const list = await prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, fullName: true, department: true, role: true } },
      assigner: { select: { id: true, fullName: true } },
      _count: { select: { files: true } },
    },
    orderBy: { deadline: 'desc' },
    take: 1000,
  });
  const reasons = {};
  for (const t of list) if (t.failReason) reasons[t.failReason] = (reasons[t.failReason] || 0) + 1;
  const byStatus = {};
  for (const t of list) {
    const key = Task.isOverdue(t, now) ? 'MUDDATI_OTGAN' : t.status;
    byStatus[key] = (byStatus[key] || 0) + 1;
  }
  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({ select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } }),
    prisma.employee.findMany({ where: { department: { not: null } }, select: { department: true }, distinct: ['department'] }),
  ]);
  res.json({
    tasks: list.map((t) => {
      let delayDays = 0;
      if (t.completedAt && t.completedAt > t.deadline) delayDays = (t.completedAt - t.deadline) / 86400000;
      else if (Task.isOverdue(t, now)) delayDays = (now - t.deadline) / 86400000;
      return { ...t, isOverdue: Task.isOverdue(t, now), delayDays: Math.round(delayDays * 10) / 10, filesCount: t._count.files };
    }),
    reasons: Object.entries(reasons).map(([key, count]) => ({ key, count })),
    byStatus,
    filters: { employees, departments: departments.map((d) => d.department).sort() },
  });
}

async function taskDetail(req, res) {
  const detail = await Task.getDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: 'Vazifa topilmadi' });
  return res.json({ task: detail });
}

/* ======================== Faollik ======================== */

async function activity(req, res) {
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const [rows, weekly] = await Promise.all([analytics.ranking({ days }), analytics.teamWeeklyTrend({ weeks: 8 })]);
  res.json({ days, ranking: rows, comparison: analytics.roleComparison(rows), weekly, weights: analytics.WEIGHTS });
}

async function employeeActivity(req, res) {
  const id = Number(req.params.id);
  const employee = await Employee.findById(id);
  if (!employee) return res.status(404).json({ error: 'Xodim topilmadi' });
  const [metrics, trend, taskList] = await Promise.all([
    analytics.employeeMetrics(id, 90),
    analytics.employeeTrend(id, 8),
    prisma.task.findMany({ where: { assigneeId: id }, orderBy: { deadline: 'desc' }, take: 50, include: { assigner: { select: { fullName: true } } } }),
  ]);
  return res.json({ employee, metrics, weekly: trend.weekly, trend: trend.trend, tasks: taskList });
}

/* ======================== Sklad ======================== */

async function stockUpload(req, res) {
  if (!req.file) throw new ValidationError('Fayl tanlanmagan');
  const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  try {
    const result = await stockService.processStockFile({
      buffer: req.file.buffer,
      fileName,
      warehouse: req.body.warehouse,
      responsible: req.body.responsible,
      checkDate: parseDay(req.body.checkDate) || new Date(),
    });
    return res.status(201).json({ check: result.check, itemsWithDiff: result.itemsWithDiff, top: result.top });
  } catch (error) {
    if (error instanceof stockService.StockError) throw new ValidationError(error.message);
    throw error;
  }
}

async function stockChecks(req, res) {
  const data = await analytics.stockAnalytics();
  res.json(data);
}

async function stockCheckDetail(req, res) {
  const check = await StockCheck.getWithItems(req.params.id);
  if (!check) return res.status(404).json({ error: 'Sverka topilmadi' });
  check.items.sort((a, b) => Math.abs(b.diffSum) - Math.abs(a.diffSum) || Math.abs(b.diffQty) - Math.abs(a.diffQty));
  return res.json({ check });
}

async function stockDelete(req, res) {
  await StockCheck.remove(req.params.id);
  res.json({ ok: true });
}

function stockTemplate(req, res) {
  const buffer = stockService.buildTemplate();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="sverka-shablon.xlsx"');
  res.send(buffer);
}

/* ======================== Moliya ======================== */

async function finance(req, res) {
  const [data, entries] = await Promise.all([analytics.financeOverview(), Finance.entries.list()]);
  res.json({ ...data, entries, metrics: METRICS, expenseCategories: EXPENSE_CATEGORIES });
}

async function saveFinanceEntry(req, res) {
  const { month, type, category, planAmount, factAmount } = req.body || {};
  if (!FINANCE_TYPES.includes(type)) throw new ValidationError("Turi noto'g'ri");
  const entry = await Finance.entries.upsert({
    month: validMonth(month),
    type,
    category: requireText(category || (type === 'TUSHUM' ? 'Savdo' : type === 'TANNARX' ? 'Tovar tannarxi' : ''), 'Toifa', 60),
    planAmount: toAmount(planAmount),
    factAmount: toAmount(factAmount),
  });
  res.json({ entry });
}

async function deleteFinanceEntry(req, res) {
  await Finance.entries.remove(req.params.id);
  res.json({ ok: true });
}

function goalPayload(body) {
  const { name, metric, category, condition, targetValue, period } = body || {};
  if (!METRICS[metric]) throw new ValidationError("Ko'rsatkich noto'g'ri");
  if (!['GTE', 'LTE'].includes(condition)) throw new ValidationError("Shart noto'g'ri");
  const target = Number(targetValue);
  if (!Number.isFinite(target)) throw new ValidationError("Maqsadli qiymat noto'g'ri");
  return {
    name: requireText(name, 'Maqsad nomi'),
    metric,
    category: metric === 'TOIFA_ULUSHI' ? requireText(category, 'Xarajat toifasi', 60) : null,
    condition,
    targetValue: target,
    period: requireText(period, 'Davr', 60),
  };
}

async function createGoal(req, res) {
  res.status(201).json({ goal: await Finance.goals.create(goalPayload(req.body)) });
}

async function updateGoal(req, res) {
  res.json({ goal: await Finance.goals.update(req.params.id, goalPayload(req.body)) });
}

async function deleteGoal(req, res) {
  await Finance.goals.remove(req.params.id);
  res.json({ ok: true });
}

function decisionPayload(body) {
  const { date, title, description, metric, category, expectedResult } = body || {};
  if (!METRICS[metric]) throw new ValidationError("Ko'rsatkich noto'g'ri");
  const parsed = parseDay(date);
  if (!parsed) throw new ValidationError("Sana noto'g'ri");
  return {
    date: parsed,
    title: requireText(title, 'Qaror nomi'),
    description: description ? String(description).slice(0, 2000) : null,
    metric,
    category: metric === 'TOIFA_ULUSHI' ? requireText(category, 'Xarajat toifasi', 60) : null,
    expectedResult: expectedResult ? String(expectedResult).slice(0, 1000) : null,
  };
}

async function createDecision(req, res) {
  res.status(201).json({ decision: await Finance.decisions.create(decisionPayload(req.body)) });
}

async function updateDecision(req, res) {
  res.json({ decision: await Finance.decisions.update(req.params.id, decisionPayload(req.body)) });
}

async function deleteDecision(req, res) {
  await Finance.decisions.remove(req.params.id);
  res.json({ ok: true });
}

async function evaluateDecision(req, res) {
  const decision = await Finance.decisions.get(req.params.id);
  if (!decision) return res.status(404).json({ error: 'Qaror topilmadi' });
  const rows = await analytics.financeMonths(36);
  const evaluated = analytics.evaluateDecision(decision, rows);
  const result = await ai.evaluateDecision(evaluated);
  const updated = await Finance.decisions.update(decision.id, { aiVerdict: result.verdict, aiComment: result.comment });
  return res.json({ decision: updated, source: result.source });
}

/* ======================== AI ======================== */

async function generateAi(req, res) {
  const module = String(req.params.module || '').toUpperCase();
  if (!MODULES.includes(module)) throw new ValidationError("Noma'lum modul");
  const result = await ai.generateReport(module);
  if (!result.ok) return res.status(503).json({ error: result.message });
  return res.json({ report: result.report });
}

async function askAi(req, res) {
  const question = requireText(req.body?.question, 'Savol', 1000);
  const result = await ai.askQuestion(question);
  if (!result.ok) return res.status(503).json({ error: result.message });
  return res.json({ report: result.report });
}

async function aiReports(req, res) {
  const module = MODULES.includes(req.query.module) ? req.query.module : undefined;
  const reports = await AiReport.list({ module, from: parseDay(req.query.from), to: parseDay(req.query.to, true), take: 200 });
  res.json({ reports, aiEnabled: ai.isEnabled() });
}

async function latestAi(req, res) {
  const module = String(req.params.module || '').toUpperCase();
  if (!MODULES.includes(module)) throw new ValidationError("Noma'lum modul");
  res.json({ report: await AiReport.latest(module), aiEnabled: ai.isEnabled() });
}

async function deleteAiReport(req, res) {
  await AiReport.remove(req.params.id);
  res.json({ ok: true });
}

/* ======================== Xodimlar ======================== */

async function employees(req, res) {
  const list = await Employee.listAll();
  res.json({ employees: list.map((e) => ({ ...e, roleLabel: ROLE_LABELS[e.role] })) });
}

async function employeePayload(body, id = null) {
  const { fullName, phone, position, department, role, managerId, isStockResponsible } = body || {};
  if (!ROLES.includes(role)) throw new ValidationError("Rol noto'g'ri");
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone.replace(/\D/g, '').length < 9) throw new ValidationError("Telefon raqam noto'g'ri");
  const duplicate = await prisma.employee.findFirst({ where: { phone: normalizedPhone, ...(id ? { NOT: { id } } : {}) } });
  if (duplicate) throw new ValidationError(`Bu raqam allaqachon ${duplicate.fullName} uchun kiritilgan`);
  let manager = null;
  if (managerId) {
    manager = Number(managerId);
    if (id && manager === id) throw new ValidationError("Xodim o'ziga o'zi rahbar bo'la olmaydi");
    if (id && (await Employee.getSubordinateIds(id)).includes(manager)) {
      throw new ValidationError("Bo'ysunuvchini rahbar qilib belgilab bo'lmaydi");
    }
  }
  return {
    fullName: requireText(fullName, 'Ism', 100),
    phone: normalizedPhone,
    position: position ? String(position).slice(0, 100) : null,
    department: department ? String(department).slice(0, 100) : null,
    role,
    managerId: role === 'DIRECTOR' ? null : manager,
    isStockResponsible: Boolean(isStockResponsible),
  };
}

async function createEmployee(req, res) {
  const data = await employeePayload(req.body);
  res.status(201).json({ employee: await prisma.employee.create({ data }) });
}

async function updateEmployee(req, res) {
  const id = Number(req.params.id);
  const data = await employeePayload(req.body, id);
  res.json({ employee: await prisma.employee.update({ where: { id }, data }) });
}

async function setEmployeeActive(req, res) {
  const id = Number(req.params.id);
  const isActive = Boolean(req.body?.isActive);
  const target = await prisma.employee.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: 'Xodim topilmadi' });
  if (!isActive && target.role === 'DIRECTOR') throw new ValidationError("Direktorni faolsizlantirib bo'lmaydi");
  const data = { isActive };
  if (!isActive) data.telegramId = null;
  res.json({ employee: await prisma.employee.update({ where: { id }, data }) });
}

/* ======================== Sozlamalar ======================== */

async function getSettings(req, res) {
  let company = await prisma.company.findFirst();
  if (!company) company = await prisma.company.create({ data: { name: 'Kompaniya' } });
  res.json({ company, aiEnabled: ai.isEnabled() });
}

async function updateSettings(req, res) {
  const { name, industry, currency, weeklyReportTime, weeklyReportDay, monthlyReportDay } = req.body || {};
  if (weeklyReportTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(weeklyReportTime)) throw new ValidationError("Vaqt noto'g'ri (masalan 09:00)");
  const day = Number(weeklyReportDay);
  const mday = Number(monthlyReportDay);
  const data = {
    name: requireText(name, 'Kompaniya nomi', 120),
    industry: industry ? String(industry).slice(0, 120) : null,
    currency: currency ? String(currency).slice(0, 10) : "so'm",
    weeklyReportTime: weeklyReportTime || '09:00',
    weeklyReportDay: day >= 0 && day <= 6 ? day : 1,
    monthlyReportDay: mday >= 1 && mday <= 28 ? mday : 1,
  };
  const existing = await prisma.company.findFirst();
  const company = existing ? await prisma.company.update({ where: { id: existing.id }, data }) : await prisma.company.create({ data });
  res.json({ company });
}

module.exports = {
  ValidationError,
  overview,
  tasks,
  taskDetail,
  activity,
  employeeActivity,
  stockUpload,
  stockChecks,
  stockCheckDetail,
  stockDelete,
  stockTemplate,
  finance,
  saveFinanceEntry,
  deleteFinanceEntry,
  createGoal,
  updateGoal,
  deleteGoal,
  createDecision,
  updateDecision,
  deleteDecision,
  evaluateDecision,
  generateAi,
  askAi,
  aiReports,
  latestAi,
  deleteAiReport,
  employees,
  createEmployee,
  updateEmployee,
  setEmployeeActive,
  getSettings,
  updateSettings,
};
