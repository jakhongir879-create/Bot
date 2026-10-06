const { InlineKeyboard } = require('grammy');
const { bot } = require('../core/bot');
const { config } = require('../config/default');
const { STATUS_LABELS, STATUS_ICONS, PRIORITY_LABELS, PRIORITY_ICONS, REASON_LABELS } = require('../utils/labels');
const { formatDateTime, timeLeft, escapeHtml } = require('../utils/format');

const REASON_CODES = ['RESURS_YETMADI', 'BOSHQA_BOLIMGA_BOGLIQ', 'VAQT_YETMADI', 'TOPSHIRIQ_NOANIQ', 'BOSHQA'];

function webAppAvailable() {
  return config.webappUrl.startsWith('https://');
}

function webAppUrl(path = '') {
  return `${config.webappUrl}${path}`;
}

function taskCard(task, { withStatus = true } = {}) {
  const lines = [`📌 <b>${escapeHtml(task.title)}</b>`];
  if (task.description) lines.push(`<i>${escapeHtml(task.description)}</i>`);
  lines.push('');
  if (task.assigner) lines.push(`👤 Beruvchi: ${escapeHtml(task.assigner.fullName)}`);
  if (task.assignee) lines.push(`👷 Ijrochi: ${escapeHtml(task.assignee.fullName)}`);
  lines.push(`⏰ Deadline: ${formatDateTime(task.deadline)} (${timeLeft(task.deadline)})`);
  lines.push(`${PRIORITY_ICONS[task.priority]} Muhimlik: ${PRIORITY_LABELS[task.priority]} · 🎯 KPI: ${task.kpiWeight || 3}/5`);
  if (withStatus) {
    const progress = task.status === 'JARAYONDA' ? ` (${task.progress}%)` : '';
    lines.push(`📍 Holat: ${STATUS_ICONS[task.status]} ${STATUS_LABELS[task.status]}${progress}`);
    if (task.qualityScore) lines.push(`⭐ Baho: ${'⭐'.repeat(task.qualityScore)}`);
    if (task.failReason) {
      lines.push(`❗ Sabab: ${REASON_LABELS[task.failReason]}${task.failReasonText ? ` — ${escapeHtml(task.failReasonText)}` : ''}`);
    }
  }
  lines.push(`🆔 #${task.id}`);
  return lines.join('\n');
}

function executorKeyboard(task) {
  const kb = new InlineKeyboard();
  if (['YANGI', 'QAYTARILDI'].includes(task.status)) kb.text('✅ Qabul qildim', `t:acc:${task.id}`);
  kb.text('⏳ Jarayonda', `t:prg:${task.id}`).row();
  kb.text('✔️ Bajarildi', `t:done:${task.id}`).text('❌ Bajara olmayman', `t:fail:${task.id}`).row();
  kb.text('📎 Fayl biriktirish', `t:file:${task.id}`);
  return kb;
}

function progressKeyboard(taskId) {
  return new InlineKeyboard().text('25%', `t:p:${taskId}:25`).text('50%', `t:p:${taskId}:50`).text('75%', `t:p:${taskId}:75`);
}

function reasonKeyboard(taskId, prefix) {
  const kb = new InlineKeyboard();
  REASON_CODES.forEach((code, i) => {
    kb.text(REASON_LABELS[code] + (code === 'BOSHQA' ? ' (yozing)' : ''), `t:${prefix}:${taskId}:${i}`).row();
  });
  return kb;
}

function rateKeyboard(taskId) {
  const kb = new InlineKeyboard();
  for (let i = 1; i <= 5; i += 1) kb.text(`${i}⭐`, `t:rate:${taskId}:${i}`);
  return kb.row().text('🔁 Qayta ishlashga qaytarish', `t:ret:${taskId}`);
}

function openAppKeyboard(label = '📱 Ilovani ochish', path = '/') {
  if (!webAppAvailable()) return undefined;
  return new InlineKeyboard().webApp(label, webAppUrl(path));
}

async function send(telegramId, text, extra = {}) {
  if (!telegramId) return null;
  try {
    return await bot.api.sendMessage(telegramId, text, { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...extra });
  } catch (error) {
    console.error(`[NOTIFY] ${telegramId} ga xabar yuborilmadi:`, error.description || error.message);
    return null;
  }
}

/** Uzun matnni (AI hisobotlari) bo'laklab, formatlashsiz yuboradi */
async function sendLong(telegramId, text, extra = {}) {
  if (!telegramId) return;
  const chunks = [];
  let rest = String(text);
  while (rest.length > 3900) {
    let cut = rest.lastIndexOf('\n', 3900);
    if (cut < 1000) cut = 3900;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  chunks.push(rest);
  for (let i = 0; i < chunks.length; i += 1) {
    try {
      await bot.api.sendMessage(telegramId, chunks[i], i === chunks.length - 1 ? extra : {});
    } catch (error) {
      console.error(`[NOTIFY] ${telegramId} ga hisobot yuborilmadi:`, error.description || error.message);
      return;
    }
  }
}

async function taskCreated(task) {
  await send(task.assignee.telegramId, `🆕 <b>Sizga yangi vazifa berildi</b>\n\n${taskCard(task, { withStatus: false })}`, {
    reply_markup: executorKeyboard(task),
  });
}

async function statusChanged(task, event, extraText = '') {
  const who = escapeHtml(task.assignee.fullName);
  const map = {
    accepted: `👌 ${who} vazifani qabul qildi`,
    progress: `⏳ ${who}: vazifa ${task.progress}% bajarildi`,
    failed: `❌ ${who} vazifani bajara olmasligini bildirdi`,
    overdueReason: `📝 ${who} kechikish sababini yozdi`,
  };
  await send(task.assigner.telegramId, `${map[event]}${extraText}\n\n${taskCard(task)}`);
}

async function taskCompleted(task) {
  await send(
    task.assigner.telegramId,
    `✔️ <b>${escapeHtml(task.assignee.fullName)} vazifani bajardi</b>\n\n${taskCard(task)}\n\nIshni baholang yoki qayta ishlashga qaytaring:`,
    { reply_markup: rateKeyboard(task.id) },
  );
}

async function taskRated(task) {
  await send(task.assignee.telegramId, `⭐ <b>Vazifangiz baholandi: ${'⭐'.repeat(task.qualityScore)}</b>\n\n${taskCard(task)}`);
}

async function taskReturned(task, comment) {
  await send(
    task.assignee.telegramId,
    `🔁 <b>Vazifa qayta ishlashga qaytarildi</b>\n💬 Izoh: ${escapeHtml(comment)}\n\n${taskCard(task)}`,
    { reply_markup: executorKeyboard(task) },
  );
}

async function forwardFile(task, file, uploaderName) {
  const target = task.assigner.telegramId;
  if (!target) return null;
  const caption = `📎 ${escapeHtml(uploaderName)} "${escapeHtml(task.title)}" (#${task.id}) vazifasiga fayl yubordi${file.isLate ? '\n⚠️ Deadline\'dan keyin yuklandi' : ''}`;
  try {
    if (file.fileType === 'photo') return await bot.api.sendPhoto(target, file.fileId, { caption, parse_mode: 'HTML' });
    return await bot.api.sendDocument(target, file.fileId, { caption, parse_mode: 'HTML' });
  } catch (error) {
    console.error('[NOTIFY] Fayl yuborilmadi:', error.description || error.message);
    return null;
  }
}

async function sendStoredFile(telegramId, file) {
  if (file.fileType === 'photo') return bot.api.sendPhoto(telegramId, file.fileId, { caption: file.fileName });
  return bot.api.sendDocument(telegramId, file.fileId, { caption: file.fileName });
}

async function reminder(task, hours) {
  await send(task.assignee.telegramId, `⏰ <b>Eslatma: deadline'gacha ${hours} soat qoldi</b>\n\n${taskCard(task)}`, {
    reply_markup: executorKeyboard(task),
  });
}

async function overdue(task) {
  await send(
    task.assignee.telegramId,
    `🚨 <b>Vazifa muddati o'tdi!</b>\n\n${taskCard(task)}\n\nIltimos, kechikish sababini tanlang:`,
    { reply_markup: reasonKeyboard(task.id, 'or') },
  );
  await send(task.assigner.telegramId, `🚨 <b>Siz bergan vazifaning muddati o'tdi</b>\n\n${taskCard(task)}`);
}

module.exports = {
  REASON_CODES,
  webAppAvailable,
  webAppUrl,
  taskCard,
  executorKeyboard,
  progressKeyboard,
  reasonKeyboard,
  rateKeyboard,
  openAppKeyboard,
  send,
  sendLong,
  taskCreated,
  statusChanged,
  taskCompleted,
  taskRated,
  taskReturned,
  forwardFile,
  sendStoredFile,
  reminder,
  overdue,
};
