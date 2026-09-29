const { prisma } = require('../database/connection');

const ACTIVE_STATUSES = ['YANGI', 'QABUL_QILINDI', 'JARAYONDA', 'QAYTARILDI'];
const FINAL_STATUSES = ['BAJARILDI', 'BAJARILMADI'];
const REASONS = ['RESURS_YETMADI', 'BOSHQA_BOLIMGA_BOGLIQ', 'VAQT_YETMADI', 'TOPSHIRIQ_NOANIQ', 'BOSHQA'];
const PRIORITIES = ['PAST', 'ORTA', 'YUQORI'];

const personSelect = { id: true, fullName: true, position: true, department: true, role: true, telegramId: true };

const withPeople = {
  assigner: { select: personSelect },
  assignee: { select: personSelect },
};

class TaskError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function isOverdue(task, now = new Date()) {
  return ACTIVE_STATUSES.includes(task.status) && new Date(task.deadline) < now;
}

function getById(id) {
  return prisma.task.findUnique({ where: { id: Number(id) }, include: withPeople });
}

function getDetail(id) {
  return prisma.task.findUnique({
    where: { id: Number(id) },
    include: {
      ...withPeople,
      history: {
        orderBy: { createdAt: 'asc' },
        include: { employee: { select: { id: true, fullName: true } } },
      },
      files: {
        orderBy: { uploadedAt: 'desc' },
        include: { uploader: { select: { id: true, fullName: true } } },
      },
    },
  });
}

async function createTask({ title, description, assignerId, assigneeId, deadline, priority }) {
  if (!title || !String(title).trim()) throw new TaskError('Vazifa sarlavhasi kiritilmagan');
  if (!deadline || Number.isNaN(new Date(deadline).getTime())) throw new TaskError("Deadline noto'g'ri");
  if (!PRIORITIES.includes(priority)) priority = 'ORTA';
  return prisma.task.create({
    data: {
      title: String(title).trim().slice(0, 200),
      description: description ? String(description).trim().slice(0, 3000) : null,
      assignerId,
      assigneeId: Number(assigneeId),
      deadline: new Date(deadline),
      priority,
      history: { create: { changedBy: assignerId, newStatus: 'YANGI', comment: 'Vazifa yaratildi' } },
    },
    include: withPeople,
  });
}

async function applyChange(task, actorId, data, newStatus, comment) {
  return prisma.task.update({
    where: { id: task.id },
    data: {
      ...data,
      history: {
        create: {
          changedBy: actorId,
          oldStatus: task.status,
          newStatus: newStatus || task.status,
          comment: comment || null,
        },
      },
    },
    include: withPeople,
  });
}

function ensureAssignee(task, actor) {
  if (task.assigneeId !== actor.id) throw new TaskError('Bu amalni faqat ijrochi bajara oladi', 403);
}

function ensureAssigner(task, actor) {
  if (task.assignerId !== actor.id && actor.role !== 'DIRECTOR') {
    throw new TaskError('Bu amalni faqat vazifa beruvchi bajara oladi', 403);
  }
}

function ensureActive(task) {
  if (!ACTIVE_STATUSES.includes(task.status)) throw new TaskError('Bu vazifa allaqachon yakunlangan');
}

async function accept(task, actor) {
  ensureAssignee(task, actor);
  if (!['YANGI', 'QAYTARILDI'].includes(task.status)) throw new TaskError('Vazifa allaqachon qabul qilingan');
  return applyChange(task, actor.id, { status: 'QABUL_QILINDI', acceptedAt: task.acceptedAt || new Date() }, 'QABUL_QILINDI', 'Qabul qilindi');
}

async function setProgress(task, actor, progress) {
  ensureAssignee(task, actor);
  ensureActive(task);
  const value = Math.max(1, Math.min(99, Math.round(Number(progress) || 0)));
  return applyChange(
    task,
    actor.id,
    { status: 'JARAYONDA', progress: value, acceptedAt: task.acceptedAt || new Date() },
    'JARAYONDA',
    `Bajarilish: ${value}%`,
  );
}

async function complete(task, actor) {
  ensureAssignee(task, actor);
  ensureActive(task);
  const now = new Date();
  const late = now > new Date(task.deadline);
  return applyChange(
    task,
    actor.id,
    { status: 'BAJARILDI', progress: 100, completedAt: now, acceptedAt: task.acceptedAt || now, qualityScore: null },
    'BAJARILDI',
    late ? 'Bajarildi (muddatidan kechikib)' : 'Bajarildi',
  );
}

async function fail(task, actor, reason, reasonText) {
  ensureAssignee(task, actor);
  ensureActive(task);
  if (!REASONS.includes(reason)) throw new TaskError('Sabab tanlanmagan');
  if (reason === 'BOSHQA' && !String(reasonText || '').trim()) throw new TaskError('Sababni yozing');
  return applyChange(
    task,
    actor.id,
    { status: 'BAJARILMADI', failReason: reason, failReasonText: reasonText ? String(reasonText).slice(0, 1000) : null },
    'BAJARILMADI',
    reasonText ? `Sabab: ${reasonText}` : null,
  );
}

async function setOverdueReason(task, actor, reason, reasonText) {
  ensureAssignee(task, actor);
  if (!REASONS.includes(reason)) throw new TaskError('Sabab tanlanmagan');
  return applyChange(
    task,
    actor.id,
    { failReason: reason, failReasonText: reasonText ? String(reasonText).slice(0, 1000) : null },
    task.status,
    `Kechikish sababi${reasonText ? `: ${reasonText}` : ''}`,
  );
}

async function rate(task, actor, score) {
  ensureAssigner(task, actor);
  if (task.status !== 'BAJARILDI') throw new TaskError('Faqat bajarilgan vazifani baholash mumkin');
  const value = Math.round(Number(score));
  if (!(value >= 1 && value <= 5)) throw new TaskError("Baho 1 dan 5 gacha bo'lishi kerak");
  return applyChange(task, actor.id, { qualityScore: value }, 'BAJARILDI', `Baho: ${'⭐'.repeat(value)}`);
}

async function returnForRework(task, actor, comment) {
  ensureAssigner(task, actor);
  if (task.status !== 'BAJARILDI') throw new TaskError('Faqat bajarilgan vazifani qaytarish mumkin');
  if (!String(comment || '').trim()) throw new TaskError('Qaytarish sababini yozing');
  return applyChange(
    task,
    actor.id,
    {
      status: 'QAYTARILDI',
      returnCount: { increment: 1 },
      completedAt: null,
      qualityScore: null,
      progress: 50,
      remind24Sent: false,
      remind2Sent: false,
    },
    'QAYTARILDI',
    String(comment).slice(0, 1000),
  );
}

function addFile({ taskId, uploadedBy, fileName, fileId, fileType, deadline }) {
  return prisma.taskFile.create({
    data: {
      taskId,
      uploadedBy,
      fileName: String(fileName || 'fayl').slice(0, 200),
      fileId,
      fileType: fileType || 'document',
      isLate: new Date() > new Date(deadline),
    },
  });
}

function activeForAssignee(employeeId) {
  return prisma.task.findMany({
    where: { assigneeId: employeeId, status: { in: ACTIVE_STATUSES } },
    orderBy: { deadline: 'asc' },
    include: withPeople,
  });
}

function recentForAssigner(employeeId, take = 15) {
  return prisma.task.findMany({
    where: { assignerId: employeeId },
    orderBy: [{ createdAt: 'desc' }],
    take,
    include: withPeople,
  });
}

module.exports = {
  ACTIVE_STATUSES,
  FINAL_STATUSES,
  REASONS,
  PRIORITIES,
  withPeople,
  TaskError,
  isOverdue,
  getById,
  getDetail,
  createTask,
  accept,
  setProgress,
  complete,
  fail,
  setOverdueReason,
  rate,
  returnForRework,
  addFile,
  activeForAssignee,
  recentForAssigner,
};
