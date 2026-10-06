const { InputFile } = require('grammy');
const { prisma } = require('../database/connection');
const { bot } = require('../core/bot');
const Employee = require('../models/Employee');
const Task = require('../models/Task');
const notify = require('../services/notify.service');
const analytics = require('../services/analytics.service');
const { ROLE_LABELS } = require('../utils/labels');

const ALLOWED_FILE_TYPES = /\.(pdf|docx?|xlsx?|csv|pptx?|txt|jpe?g|png|webp|heic|zip|rar)$/i;

function serializeTask(task, now = new Date()) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    deadline: task.deadline,
    priority: task.priority,
    kpiWeight: task.kpiWeight,
    status: task.status,
    progress: task.progress,
    acceptedAt: task.acceptedAt,
    completedAt: task.completedAt,
    qualityScore: task.qualityScore,
    returnCount: task.returnCount,
    failReason: task.failReason,
    failReasonText: task.failReasonText,
    createdAt: task.createdAt,
    isOverdue: Task.isOverdue(task, now),
    assigner: task.assigner ? { id: task.assigner.id, fullName: task.assigner.fullName } : undefined,
    assignee: task.assignee ? { id: task.assignee.id, fullName: task.assignee.fullName, position: task.assignee.position } : undefined,
  };
}

function serializeEmployee(e) {
  return {
    id: e.id,
    fullName: e.fullName,
    position: e.position,
    department: e.department,
    role: e.role,
    roleLabel: ROLE_LABELS[e.role],
    isStockResponsible: e.isStockResponsible,
    onboarded: e.onboarded,
  };
}

async function canViewTask(employee, task) {
  if (employee.role === 'DIRECTOR') return true;
  if (task.assigneeId === employee.id || task.assignerId === employee.id) return true;
  if (employee.role === 'TOP') {
    const ids = await Employee.getSubordinateIds(employee.id);
    return ids.includes(task.assigneeId);
  }
  return false;
}

async function loadTaskOr404(req, res) {
  const task = await Task.getById(req.params.id);
  if (!task || !(await canViewTask(req.employee, task))) {
    res.status(404).json({ error: 'Vazifa topilmadi' });
    return null;
  }
  return task;
}

function filterWhere(filter, now) {
  switch (filter) {
    case 'new':
      return { status: { in: ['YANGI', 'QAYTARILDI'] } };
    case 'progress':
      return { status: { in: ['QABUL_QILINDI', 'JARAYONDA'] }, deadline: { gte: now } };
    case 'overdue':
      return { status: { in: Task.ACTIVE_STATUSES }, deadline: { lt: now } };
    case 'done':
      return { status: { in: ['BAJARILDI', 'BAJARILMADI'] } };
    default:
      return {};
  }
}

async function me(req, res) {
  const employee = req.employee;
  const [metrics, personal, trend] = await Promise.all([
    analytics.employeeMetrics(employee.id, 30),
    analytics.personalDashboard(employee),
    analytics.employeeTrend(employee.id, 2),
  ]);
  res.json({
    employee: serializeEmployee(employee),
    metrics,
    trend: trend.trend,
    today: {
      activeCount: personal.activeCount,
      todayCount: personal.todayCount,
      overdueCount: personal.overdueCount,
    },
    upcoming: personal.upcoming.map((t) => serializeTask(t)),
    canAssign: employee.role !== 'MIDDLE',
  });
}

async function markOnboarded(req, res) {
  await Employee.update(req.employee.id, { onboarded: true });
  res.json({ ok: true });
}

async function listTasks(req, res) {
  const employee = req.employee;
  const now = new Date();
  const scope = req.query.scope || 'mine';
  let where;
  if (scope === 'given' && employee.role !== 'MIDDLE') where = { assignerId: employee.id };
  else if (scope === 'team' && employee.role !== 'MIDDLE') {
    const ids = employee.role === 'DIRECTOR' ? undefined : await Employee.getSubordinateIds(employee.id);
    where = ids ? { assigneeId: { in: ids } } : {};
  } else where = { assigneeId: employee.id };

  const tasks = await prisma.task.findMany({
    where: { ...where, ...filterWhere(req.query.filter, now) },
    include: Task.withPeople,
    orderBy: { deadline: 'asc' },
    take: 300,
  });
  const active = tasks.filter((t) => Task.ACTIVE_STATUSES.includes(t.status));
  const finished = tasks
    .filter((t) => !Task.ACTIVE_STATUSES.includes(t.status))
    .sort((a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt));
  res.json({ tasks: [...active, ...finished].map((t) => serializeTask(t, now)) });
}

async function getTask(req, res) {
  const task = await loadTaskOr404(req, res);
  if (!task) return;
  const detail = await Task.getDetail(task.id);
  const employee = req.employee;
  res.json({
    task: serializeTask(detail),
    history: detail.history.map((h) => ({
      id: h.id,
      oldStatus: h.oldStatus,
      newStatus: h.newStatus,
      comment: h.comment,
      createdAt: h.createdAt,
      by: h.employee?.fullName || 'Tizim',
    })),
    files: detail.files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      fileType: f.fileType,
      isLate: f.isLate,
      uploadedAt: f.uploadedAt,
      by: f.uploader.fullName,
    })),
    permissions: {
      isAssignee: detail.assigneeId === employee.id,
      isAssigner: detail.assignerId === employee.id || employee.role === 'DIRECTOR',
    },
  });
}

async function assignees(req, res) {
  const list = await Employee.getAssignableEmployees(req.employee);
  res.json({ employees: list.map(serializeEmployee) });
}

async function createTask(req, res) {
  const employee = req.employee;
  const { title, description, assigneeId, deadline, priority, kpiWeight } = req.body || {};
  if (employee.role === 'MIDDLE') return res.status(403).json({ error: "Sizda vazifa berish huquqi yo'q" });
  if (!(await Employee.canAssignTo(employee, assigneeId))) return res.status(403).json({ error: 'Bu xodimga vazifa bera olmaysiz' });
  if (new Date(deadline) < new Date()) return res.status(400).json({ error: "Deadline o'tib ketgan sana bo'lmasligi kerak" });
  const task = await Task.createTask({ title, description, assignerId: employee.id, assigneeId, deadline, priority, kpiWeight });
  await notify.taskCreated(task);
  return res.status(201).json({ task: serializeTask(task) });
}

async function changeStatus(req, res) {
  const task = await loadTaskOr404(req, res);
  if (!task) return;
  const employee = req.employee;
  const { action, progress, reason, reasonText, score, comment } = req.body || {};
  let updated;
  switch (action) {
    case 'accept':
      updated = await Task.accept(task, employee);
      await notify.statusChanged(updated, 'accepted');
      break;
    case 'progress':
      updated = await Task.setProgress(task, employee, progress);
      await notify.statusChanged(updated, 'progress');
      break;
    case 'complete':
      updated = await Task.complete(task, employee);
      await notify.taskCompleted(updated);
      break;
    case 'fail':
      updated = await Task.fail(task, employee, reason, reasonText);
      await notify.statusChanged(updated, 'failed');
      break;
    case 'overdueReason':
      updated = await Task.setOverdueReason(task, employee, reason, reasonText);
      await notify.statusChanged(updated, 'overdueReason');
      break;
    case 'rate':
      updated = await Task.rate(task, employee, score);
      await notify.taskRated(updated);
      break;
    case 'return':
      updated = await Task.returnForRework(task, employee, comment);
      await notify.taskReturned(updated, comment);
      break;
    default:
      return res.status(400).json({ error: "Noma'lum amal" });
  }
  return res.json({ task: serializeTask(updated) });
}

async function uploadFile(req, res) {
  const task = await loadTaskOr404(req, res);
  if (!task) return;
  const employee = req.employee;
  if (task.assigneeId !== employee.id) return res.status(403).json({ error: 'Fayl faqat ijrochi tomonidan biriktiriladi' });
  if (!req.file) return res.status(400).json({ error: 'Fayl tanlanmagan' });
  const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  if (!ALLOWED_FILE_TYPES.test(originalName)) return res.status(400).json({ error: "Bu turdagi faylni yuklab bo'lmaydi" });

  const target = task.assigner.telegramId || employee.telegramId;
  if (!target) return res.status(400).json({ error: 'Faylni saqlash uchun Telegram hisob ulanmagan' });
  const isLate = new Date() > new Date(task.deadline);
  const caption = `📎 ${employee.fullName} "${task.title}" (#${task.id}) vazifasiga fayl yukladi${isLate ? "\n⚠️ Deadline'dan keyin yuklandi" : ''}`;
  const isImage = /^image\/(jpeg|png|webp)$/.test(req.file.mimetype);
  let fileId;
  let fileType = 'document';
  if (isImage) {
    const msg = await bot.api.sendPhoto(target, new InputFile(req.file.buffer, originalName), { caption });
    fileId = msg.photo[msg.photo.length - 1].file_id;
    fileType = 'photo';
  } else {
    const msg = await bot.api.sendDocument(target, new InputFile(req.file.buffer, originalName), { caption });
    fileId = msg.document.file_id;
  }
  const saved = await Task.addFile({ taskId: task.id, uploadedBy: employee.id, fileName: originalName, fileId, fileType, deadline: task.deadline });
  return res.status(201).json({ file: { id: saved.id, fileName: saved.fileName, isLate: saved.isLate, uploadedAt: saved.uploadedAt, by: employee.fullName } });
}

async function sendFileToChat(req, res) {
  const file = await prisma.taskFile.findUnique({ where: { id: Number(req.params.fileId) }, include: { task: true } });
  if (!file || !(await canViewTask(req.employee, file.task))) return res.status(404).json({ error: 'Fayl topilmadi' });
  await notify.sendStoredFile(req.employee.telegramId, file);
  return res.json({ ok: true });
}

async function team(req, res) {
  const employee = req.employee;
  if (employee.role === 'MIDDLE') return res.status(403).json({ error: "Bu bo'lim faqat rahbarlar uchun" });
  const ids = employee.role === 'DIRECTOR' ? null : await Employee.getSubordinateIds(employee.id);
  if (ids && !ids.length) return res.json({ members: [] });
  const rows = await analytics.ranking({ days: 30, employeeIds: ids });
  return res.json({
    members: rows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      position: r.position,
      department: r.department,
      role: r.role,
      roleLabel: ROLE_LABELS[r.role],
      score: r.score,
      status: r.status,
      trend: r.trend,
      active: r.active,
      overdue: r.overdue,
    })),
  });
}

async function teamMember(req, res) {
  const employee = req.employee;
  if (employee.role === 'MIDDLE') return res.status(403).json({ error: "Bu bo'lim faqat rahbarlar uchun" });
  const memberId = Number(req.params.id);
  const visible = await Employee.getVisibleEmployeeIds(employee);
  if (!visible.includes(memberId) || memberId === employee.id) return res.status(404).json({ error: 'Xodim topilmadi' });
  const member = await Employee.findById(memberId);
  if (!member) return res.status(404).json({ error: 'Xodim topilmadi' });
  const [metrics, trend, tasks] = await Promise.all([
    analytics.employeeMetrics(memberId, 30),
    analytics.employeeTrend(memberId, 8),
    prisma.task.findMany({ where: { assigneeId: memberId }, include: Task.withPeople, orderBy: { deadline: 'desc' }, take: 30 }),
  ]);
  return res.json({ member: serializeEmployee(member), metrics, weekly: trend.weekly, trend: trend.trend, tasks: tasks.map((t) => serializeTask(t)) });
}

async function profile(req, res) {
  const employee = req.employee;
  const [metrics, metrics90, trend, completed] = await Promise.all([
    analytics.employeeMetrics(employee.id, 30),
    analytics.employeeMetrics(employee.id, 90),
    analytics.employeeTrend(employee.id, 8),
    prisma.task.findMany({
      where: { assigneeId: employee.id, status: { in: ['BAJARILDI', 'BAJARILMADI'] } },
      include: Task.withPeople,
      orderBy: { updatedAt: 'desc' },
      take: 30,
    }),
  ]);
  res.json({
    employee: serializeEmployee(employee),
    metrics,
    metrics90,
    weekly: trend.weekly,
    trend: trend.trend,
    completed: completed.map((t) => serializeTask(t)),
  });
}

module.exports = {
  me,
  markOnboarded,
  listTasks,
  getTask,
  assignees,
  createTask,
  changeStatus,
  uploadFile,
  sendFileToChat,
  team,
  teamMember,
  profile,
};
