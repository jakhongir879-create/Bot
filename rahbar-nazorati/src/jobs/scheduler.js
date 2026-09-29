const cron = require('node-cron');
const { prisma } = require('../database/connection');
const { config } = require('../config/default');
const Task = require('../models/Task');
const notify = require('../services/notify.service');
const ai = require('../services/ai.service');
const Employee = require('../models/Employee');
const { HOUR_MS, parts, monthLabel, monthKey, shiftMonth } = require('../utils/format');

const include = Task.withPeople;

async function sendReminders() {
  const now = new Date();
  const active = { status: { in: Task.ACTIVE_STATUSES } };

  const in24 = await prisma.task.findMany({
    where: { ...active, remind24Sent: false, deadline: { gt: new Date(now.getTime() + 2 * HOUR_MS), lte: new Date(now.getTime() + 24 * HOUR_MS) } },
    include,
  });
  for (const task of in24) {
    await notify.reminder(task, 24);
    await prisma.task.update({ where: { id: task.id }, data: { remind24Sent: true } });
  }

  const in2 = await prisma.task.findMany({
    where: { ...active, remind2Sent: false, deadline: { gt: now, lte: new Date(now.getTime() + 2 * HOUR_MS) } },
    include,
  });
  for (const task of in2) {
    await notify.reminder(task, 2);
    await prisma.task.update({ where: { id: task.id }, data: { remind2Sent: true, remind24Sent: true } });
  }

  const overdue = await prisma.task.findMany({
    where: { ...active, overdueNotified: false, deadline: { lte: now } },
    include,
  });
  for (const task of overdue) {
    await notify.overdue(task);
    await prisma.task.update({ where: { id: task.id }, data: { overdueNotified: true } });
  }
}

async function directorChatId() {
  if (config.directorTelegramId) return config.directorTelegramId;
  const director = await Employee.getDirector();
  return director?.telegramId || null;
}

async function sendScheduledReport(kind) {
  const chatId = await directorChatId();
  if (!chatId) return;
  const now = new Date();
  const period = kind === 'weekly' ? 'Oxirgi hafta' : monthLabel(shiftMonth(monthKey(now), -1));
  const title = kind === 'weekly' ? '📅 Haftalik umumiy hisobot' : '🗓 Oylik umumiy hisobot';
  const result = await ai.generateReport('UMUMIY', { periodLabel: period });
  if (!result.ok) {
    await notify.send(chatId, `${title}\n\n${result.message}\n\nKo'rsatkichlarni Dashboard'da ko'rishingiz mumkin.`);
    return;
  }
  await notify.sendLong(chatId, `${title} (${period})\n\n${result.report.text}`);
}

let lastRun = { weekly: null, monthly: null };

async function checkScheduledReports() {
  const company = await prisma.company.findFirst();
  const time = company?.weeklyReportTime || '09:00';
  const weekDay = company?.weeklyReportDay ?? 1;
  const monthDay = company?.monthlyReportDay ?? 1;
  const p = parts(new Date());
  const current = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
  if (current !== time) return;
  const today = `${p.year}-${p.month}-${p.day}`;
  if (p.day === monthDay && lastRun.monthly !== today) {
    lastRun.monthly = today;
    await sendScheduledReport('monthly');
  }
  if (p.weekday === weekDay && lastRun.weekly !== today) {
    lastRun.weekly = today;
    await sendScheduledReport('weekly');
  }
}

function safe(name, fn) {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (error) {
      console.error(`[CRON] ${name} xatosi:`, error.message);
    } finally {
      running = false;
    }
  };
}

function startScheduler() {
  cron.schedule('*/5 * * * *', safe('Eslatmalar', sendReminders), { timezone: config.timezone });
  cron.schedule('* * * * *', safe('Rejali hisobotlar', checkScheduledReports), { timezone: config.timezone });
  safe('Eslatmalar', sendReminders)();
  console.log('⏰ Rejali vazifalar ishga tushdi (eslatmalar har 5 daqiqada, hisobotlar sozlamalardagi vaqtda)');
}

module.exports = { startScheduler, sendReminders, sendScheduledReport };
