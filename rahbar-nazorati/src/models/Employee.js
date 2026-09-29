const { prisma } = require('../database/connection');
const { normalizePhone } = require('../utils/format');

const publicSelect = {
  id: true,
  telegramId: true,
  fullName: true,
  phone: true,
  position: true,
  department: true,
  role: true,
  managerId: true,
  isActive: true,
  isStockResponsible: true,
  onboarded: true,
  createdAt: true,
};

function findByTelegramId(telegramId) {
  return prisma.employee.findFirst({ where: { telegramId: String(telegramId), isActive: true } });
}

async function findByPhone(phone) {
  const normalized = normalizePhone(phone);
  const tail = normalized.replace(/\D/g, '').slice(-9);
  if (tail.length < 9) return null;
  const candidates = await prisma.employee.findMany({ where: { phone: { endsWith: tail }, isActive: true } });
  return candidates[0] || null;
}

function findById(id) {
  return prisma.employee.findUnique({ where: { id: Number(id) } });
}

async function linkTelegram(employeeId, telegramId) {
  await prisma.employee.updateMany({
    where: { telegramId: String(telegramId), NOT: { id: employeeId } },
    data: { telegramId: null },
  });
  return prisma.employee.update({ where: { id: employeeId }, data: { telegramId: String(telegramId) } });
}

function listActive() {
  return prisma.employee.findMany({ where: { isActive: true }, orderBy: [{ role: 'asc' }, { fullName: 'asc' }] });
}

function listAll() {
  return prisma.employee.findMany({
    select: { ...publicSelect, manager: { select: { id: true, fullName: true } } },
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { fullName: 'asc' }],
  });
}

async function getSubordinateIds(employeeId) {
  const all = await prisma.employee.findMany({ select: { id: true, managerId: true } });
  const byManager = new Map();
  for (const e of all) {
    if (!e.managerId) continue;
    if (!byManager.has(e.managerId)) byManager.set(e.managerId, []);
    byManager.get(e.managerId).push(e.id);
  }
  const result = [];
  const queue = [employeeId];
  const seen = new Set([employeeId]);
  while (queue.length) {
    const current = queue.shift();
    for (const child of byManager.get(current) || []) {
      if (seen.has(child)) continue;
      seen.add(child);
      result.push(child);
      queue.push(child);
    }
  }
  return result;
}

async function getVisibleEmployeeIds(employee) {
  if (employee.role === 'DIRECTOR') {
    const all = await prisma.employee.findMany({ select: { id: true } });
    return all.map((e) => e.id);
  }
  if (employee.role === 'TOP') {
    return [employee.id, ...(await getSubordinateIds(employee.id))];
  }
  return [employee.id];
}

async function getAssignableEmployees(employee) {
  if (employee.role === 'MIDDLE') return [];
  const where = { isActive: true, NOT: { id: employee.id } };
  if (employee.role === 'TOP') {
    where.id = { in: await getSubordinateIds(employee.id) };
  }
  return prisma.employee.findMany({ where, orderBy: [{ role: 'asc' }, { fullName: 'asc' }] });
}

async function canAssignTo(employee, assigneeId) {
  const list = await getAssignableEmployees(employee);
  return list.some((e) => e.id === Number(assigneeId));
}

function getDirector() {
  return prisma.employee.findFirst({ where: { role: 'DIRECTOR', isActive: true }, orderBy: { id: 'asc' } });
}

function create(data) {
  return prisma.employee.create({ data: { ...data, phone: normalizePhone(data.phone) } });
}

function update(id, data) {
  const payload = { ...data };
  if (payload.phone) payload.phone = normalizePhone(payload.phone);
  return prisma.employee.update({ where: { id: Number(id) }, data: payload });
}

module.exports = {
  publicSelect,
  findByTelegramId,
  findByPhone,
  findById,
  linkTelegram,
  listActive,
  listAll,
  getSubordinateIds,
  getVisibleEmployeeIds,
  getAssignableEmployees,
  canAssignTo,
  getDirector,
  create,
  update,
};
