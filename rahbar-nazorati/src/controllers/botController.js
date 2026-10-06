const { InlineKeyboard, Keyboard } = require('grammy');
const { config } = require('../config/default');
const { bot } = require('../core/bot');
const Employee = require('../models/Employee');
const Task = require('../models/Task');
const notify = require('../services/notify.service');
const analytics = require('../services/analytics.service');
const stockService = require('../services/stock.service');
const ai = require('../services/ai.service');
const agent = require('../services/agent.service');
const brief = require('../services/brief.service');
const { createMagicToken } = require('../middlewares/adminAuth.middleware');
const { STATUS_ICONS, STATUS_LABELS, PRIORITY_ICONS, PRIORITY_LABELS, ROLE_LABELS, MODULE_LABELS } = require('../utils/labels');
const {
  escapeHtml,
  formatDate,
  formatDateTime,
  formatMoney,
  timeLeft,
  parseDateInput,
  parts,
  tashkentDate,
  addDays,
} = require('../utils/format');

const BTN = {
  ASSIGN: '➕ Vazifa berish',
  GIVEN: '📋 Men bergan vazifalar',
  MINE: '📋 Mening vazifalarim',
  REPORT: '📊 Hisobot',
  APP: '📱 Ilovani ochish',
  PC: '💻 Kompyuterda ochish',
};

/* Foydalanuvchi holati (bosqichma-bosqich dialoglar uchun) */
const sessions = new Map();
const getSession = (id) => sessions.get(String(id)) || null;
const setSession = (id, data) => sessions.set(String(id), { ...data, updatedAt: Date.now() });
const clearSession = (id) => sessions.delete(String(id));

setInterval(() => {
  const limit = Date.now() - 6 * 60 * 60 * 1000;
  for (const [key, value] of sessions) if (value.updatedAt < limit) sessions.delete(key);
}, 60 * 60 * 1000).unref();

function mainMenu(employee) {
  const kb = new Keyboard();
  if (employee.role === 'DIRECTOR') {
    kb.text(BTN.ASSIGN).text(BTN.GIVEN).row().text(BTN.REPORT).text(BTN.APP).row().text(BTN.PC);
  } else if (employee.role === 'TOP') {
    kb.text(BTN.ASSIGN).text(BTN.GIVEN).row().text(BTN.REPORT).text(BTN.APP).row().text(BTN.MINE).text(BTN.PC);
  } else {
    kb.text(BTN.MINE).text(BTN.APP);
  }
  return kb.resized().persistent();
}

function contactKeyboard() {
  return new Keyboard().requestContact('📞 Kontaktni yuborish').resized().oneTime();
}

async function currentEmployee(ctx) {
  const telegramId = String(ctx.from.id);
  let employee = await Employee.findByTelegramId(telegramId);
  if (!employee && telegramId === config.directorTelegramId) {
    const director = await Employee.getDirector();
    if (director && !director.telegramId) employee = await Employee.linkTelegram(director.id, telegramId);
  }
  return employee;
}

async function requireEmployee(ctx) {
  const employee = await currentEmployee(ctx);
  if (!employee) {
    await ctx.reply(
      "Tizimdan foydalanish uchun telefon raqamingizni yuboring. Pastdagi <b>📞 Kontaktni yuborish</b> tugmasini bosing.",
      { parse_mode: 'HTML', reply_markup: contactKeyboard() },
    );
  }
  return employee;
}

async function sendWelcome(ctx, employee) {
  const lines = [
    `Assalomu alaykum, <b>${escapeHtml(employee.fullName)}</b>! 👋`,
    `Rolingiz: ${ROLE_LABELS[employee.role]}${employee.position && employee.position !== ROLE_LABELS[employee.role] ? ` · ${escapeHtml(employee.position)}` : ''}`,
    '',
    'Quyidagi menyudan foydalaning.',
  ];
  if (employee.role === 'DIRECTOR') {
    lines.push(
      '',
      "🤖 <b>AI yordamchi:</b> menga oddiy so'z bilan yozing, men bajaraman. Masalan:",
      "• <i>Azizga ertaga 18:00 gacha sklad hisobotini topshirishni ayt, muhim</i>",
      "• <i>Muddati o'tgan vazifalar bo'yicha hammaga eslatma yubor</i>",
      "• <i>Bu oy kim eng sust ishladi?</i>",
      '',
      "☀️ /brifing — bugungi holat va xavflar · 🧹 /yangi — AI suhbatini tozalash",
    );
    lines.push("📦 Sklad sverkasi uchun Excel faylni shu yerga yuboring.");
  } else if (employee.role === 'TOP') {
    lines.push('', "🤖 <b>AI yordamchi:</b> jamoangizga vazifa berish yoki natijalarni so'rash uchun menga oddiy so'z bilan yozing. ☀️ /brifing — jamoangizning bugungi holati.");
  }
  if (employee.role !== 'DIRECTOR' && employee.isStockResponsible) {
    lines.push('', "📦 Sklad sverkasi uchun Excel faylni shu yerga yuboring.");
  }
  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: mainMenu(employee) });
}

/* ======================== /start va kontakt ======================== */

async function handleStart(ctx) {
  clearSession(ctx.from.id);
  const employee = await currentEmployee(ctx);
  if (employee) return sendWelcome(ctx, employee);
  return ctx.reply(
    "Assalomu alaykum! 👋\n\n<b>Rahbar nazorati</b> tizimiga xush kelibsiz.\nDavom etish uchun pastdagi tugma orqali telefon raqamingizni yuboring.",
    { parse_mode: 'HTML', reply_markup: contactKeyboard() },
  );
}

async function handleContact(ctx) {
  const contact = ctx.message.contact;
  if (contact.user_id && contact.user_id !== ctx.from.id) {
    return ctx.reply("Iltimos, boshqa odamning emas, o'zingizning kontaktingizni yuboring.", { reply_markup: contactKeyboard() });
  }
  let employee = await Employee.findByPhone(contact.phone_number);
  if (!employee && String(ctx.from.id) === config.directorTelegramId) {
    const director = await Employee.getDirector();
    if (director && !director.telegramId) employee = director;
  }
  if (!employee) {
    return ctx.reply('Siz tizimda ro\'yxatdan o\'tmagansiz, rahbaringizga murojaat qiling.', {
      reply_markup: { remove_keyboard: true },
    });
  }
  const linked = await Employee.linkTelegram(employee.id, ctx.from.id);
  await ctx.reply('✅ Raqamingiz tasdiqlandi.');
  return sendWelcome(ctx, linked);
}

/* ======================== Menyu tugmalari ======================== */

async function openApp(ctx) {
  const keyboard = notify.openAppKeyboard();
  if (!keyboard) {
    return ctx.reply("📱 Ilova hali ulanmagan. Administrator .env faylga WEBAPP_URL (ngrok manzili) ni yozishi kerak.");
  }
  return ctx.reply('Ilovani ochish uchun tugmani bosing 👇', { reply_markup: keyboard });
}

async function openPanel(ctx, employee) {
  const base = config.webappUrl || `http://localhost:${config.port}`;
  const link = `${base}/dashboard/?t=${createMagicToken(employee)}`;
  const text = [
    '💻 <b>Kompyuter paneli</b>',
    '',
    "Havolani kompyuterda (Chrome yoki Edge) oching — parol kerak emas.",
    employee.role === 'TOP' ? "Panelda faqat o'z jamoangiz vazifalari va natijalari ko'rinadi." : null,
    '',
    `<code>${escapeHtml(link)}</code>`,
    '',
    "⏳ Havola 10 daqiqa amal qiladi va faqat bir marta ishlaydi.",
  ].filter((l) => l !== null).join('\n');
  const markup = base.startsWith('https://') ? new InlineKeyboard().url('💻 Panelni ochish', link) : undefined;
  return ctx.reply(text, { parse_mode: 'HTML', reply_markup: markup, link_preview_options: { is_disabled: true } });
}

function taskLine(task, showAssignee) {
  const overdue = Task.isOverdue(task);
  const who = showAssignee ? ` — ${escapeHtml(task.assignee.fullName)}` : '';
  const progress = task.status === 'JARAYONDA' ? ` ${task.progress}%` : '';
  return `${STATUS_ICONS[task.status]} <b>#${task.id}</b> ${escapeHtml(task.title)}${who}\n     ${PRIORITY_ICONS[task.priority]} ${formatDateTime(task.deadline)}${overdue ? ' 🚨 muddati o\'tgan' : ''} · ${STATUS_LABELS[task.status]}${progress}`;
}

function taskButtons(tasks) {
  const kb = new InlineKeyboard();
  tasks.forEach((t, i) => {
    kb.text(`#${t.id} ${t.title.slice(0, 22)}`, `t:view:${t.id}`);
    if (i % 2 === 1) kb.row();
  });
  return kb;
}

async function showMyTasks(ctx, employee) {
  const tasks = await Task.activeForAssignee(employee.id);
  if (!tasks.length) return ctx.reply("🎉 Sizda hozircha faol vazifa yo'q.");
  const text = [`📋 <b>Faol vazifalaringiz (${tasks.length} ta)</b>`, '', ...tasks.slice(0, 20).map((t) => taskLine(t, false))].join('\n');
  return ctx.reply(`${text}\n\nBatafsil ko'rish va holatni o'zgartirish uchun vazifani tanlang:`, {
    parse_mode: 'HTML',
    reply_markup: taskButtons(tasks.slice(0, 20)),
  });
}

async function showGivenTasks(ctx, employee) {
  const tasks = await Task.recentForAssigner(employee.id, 20);
  if (!tasks.length) return ctx.reply("Siz hali vazifa bermagansiz. «➕ Vazifa berish» tugmasini bosing.");
  const waiting = tasks.filter((t) => t.status === 'BAJARILDI' && !t.qualityScore);
  const lines = [`📋 <b>Siz bergan oxirgi vazifalar</b>`, '', ...tasks.map((t) => taskLine(t, true))];
  if (waiting.length) lines.push('', `⭐ Baholashni kutayotganlar: ${waiting.length} ta`);
  return ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: taskButtons(tasks) });
}

async function showReport(ctx, employee) {
  const now = new Date();
  const from = addDays(now, -30);
  const ids = employee.role === 'DIRECTOR' ? null : await Employee.getSubordinateIds(employee.id);
  if (ids && !ids.length) return ctx.reply("Sizga bo'ysunuvchi xodimlar yo'q.");
  const where = ids ? { assigneeId: { in: ids } } : {};
  const [summary, rows] = await Promise.all([
    analytics.taskSummary({ from, to: now, where, now }),
    analytics.ranking({ days: 30, employeeIds: ids, now }),
  ]);
  const scored = rows.filter((r) => r.score !== null);
  const fmtRow = (r) => `• ${escapeHtml(r.fullName)} — <b>${r.score}</b> (${r.status.label})`;
  const lines = [
    `📊 <b>Hisobot: oxirgi 30 kun</b>${ids ? ' (jamoangiz)' : ''}`,
    '',
    `📋 Vazifalar: ${summary.total} ta`,
    `✅ Bajarildi: ${summary.done} · ❌ Bajarilmadi: ${summary.failed}`,
    `⏳ Faol: ${summary.active} · 🚨 Muddati o'tgan: ${summary.overdue}`,
    `📈 Bajarilish: ${summary.completionRate ?? '—'}% · Muddatida: ${summary.onTimeRate ?? '—'}%`,
  ];
  if (summary.reasons.length) {
    lines.push('', '<b>Bajarilmaslik sabablari:</b>', ...summary.reasons.map((r) => `• ${r.label}: ${r.count}`));
  }
  if (scored.length) {
    lines.push('', '🏆 <b>Eng faol:</b>', ...scored.slice(0, 3).map(fmtRow));
    lines.push('', '🐢 <b>Eng sust:</b>', ...scored.slice(-3).reverse().map(fmtRow));
  }
  if (employee.role === 'DIRECTOR') {
    const finance = await analytics.financeOverview();
    const cur = finance.current;
    if (cur) {
      lines.push('', `💰 <b>Moliya (${cur.month}):</b>`, `Tushum: ${formatMoney(cur.revenue)} (reja ${cur.planExecution ?? '—'}%)`, `Sof marja: ${cur.netMargin ?? '—'}%`);
    }
  }
  const extra = { parse_mode: 'HTML' };
  if (employee.role === 'DIRECTOR') {
    extra.reply_markup = new InlineKeyboard()
      .text('🤖 Umumiy AI xulosa', 'r:ai:UMUMIY')
      .row()
      .text('🤖 Vazifalar', 'r:ai:VAZIFALAR')
      .text('🤖 Faollik', 'r:ai:FAOLLIK')
      .row()
      .text('🤖 Sklad', 'r:ai:SKLAD')
      .text('🤖 Moliya', 'r:ai:MOLIYA');
  }
  return ctx.reply(lines.join('\n'), extra);
}

/* ======================== Vazifa berish (bosqichma-bosqich) ======================== */

async function startAssign(ctx, employee) {
  if (employee.role === 'MIDDLE') return ctx.reply("Sizda vazifa berish huquqi yo'q.");
  const list = await Employee.getAssignableEmployees(employee);
  if (!list.length) return ctx.reply("Sizga bo'ysunuvchi xodimlar topilmadi. Direktor Dashboard orqali xodimlarni biriktirishi kerak.");
  setSession(ctx.from.id, { step: 'assign_who', data: {} });
  const kb = new InlineKeyboard();
  list.slice(0, 60).forEach((e, i) => {
    kb.text(`${e.role === 'TOP' ? '⭐ ' : ''}${e.fullName}`, `a:who:${e.id}`);
    if (i % 2 === 1) kb.row();
  });
  kb.row().text('✖️ Bekor qilish', 'a:cancel');
  return ctx.reply('👤 <b>1/5.</b> Vazifani kimga berasiz?', { parse_mode: 'HTML', reply_markup: kb });
}

function deadlineKeyboard() {
  return new InlineKeyboard()
    .text('Bugun', 'a:dl:today')
    .text('Ertaga', 'a:dl:tomorrow')
    .row()
    .text('3 kun', 'a:dl:3d')
    .text('1 hafta', 'a:dl:7d')
    .row()
    .text('📅 Sana yozish', 'a:dl:custom')
    .row()
    .text('✖️ Bekor qilish', 'a:cancel');
}

function presetDeadline(code, now = new Date()) {
  const p = parts(now);
  const at18 = (offset) => {
    const base = addDays(tashkentDate(p.year, p.month, p.day), offset);
    const bp = parts(base);
    return tashkentDate(bp.year, bp.month, bp.day, 18, 0);
  };
  if (code === 'today') {
    const d = at18(0);
    if (d > now) return d;
    return tashkentDate(p.year, p.month, p.day, 23, 59);
  }
  if (code === 'tomorrow') return at18(1);
  if (code === '3d') return at18(3);
  if (code === '7d') return at18(7);
  return null;
}

function priorityKeyboard() {
  return new InlineKeyboard()
    .text('🟢 Past', 'a:pr:PAST')
    .text("🟡 O'rta", 'a:pr:ORTA')
    .text('🔴 Yuqori', 'a:pr:YUQORI')
    .row()
    .text('✖️ Bekor qilish', 'a:cancel');
}

async function finishAssign(ctx, employee, session, priority) {
  const { data } = session;
  if (!(await Employee.canAssignTo(employee, data.assigneeId))) {
    clearSession(ctx.from.id);
    return ctx.reply("Bu xodimga vazifa bera olmaysiz.");
  }
  const task = await Task.createTask({
    title: data.title,
    description: data.description,
    assignerId: employee.id,
    assigneeId: data.assigneeId,
    deadline: data.deadline,
    priority,
  });
  clearSession(ctx.from.id);
  await notify.taskCreated(task);
  const warn = task.assignee.telegramId ? '' : "\n\n⚠️ Ijrochi hali botga ulanmagan — u /start bosib, raqamini yuborgach xabarlarni oladi.";
  return ctx.reply(`✅ <b>Vazifa yaratildi va ijrochiga yuborildi</b>\n\n${notify.taskCard(task)}${warn}`, {
    parse_mode: 'HTML',
    reply_markup: mainMenu(employee),
  });
}

async function handleAssignCallback(ctx, employee, action, value) {
  const session = getSession(ctx.from.id);
  if (action === 'cancel') {
    clearSession(ctx.from.id);
    await ctx.editMessageReplyMarkup().catch(() => {});
    return ctx.reply('Bekor qilindi.', { reply_markup: mainMenu(employee) });
  }
  if (!session || !session.step?.startsWith('assign_')) {
    return ctx.reply("Bu so'rov eskirgan. «➕ Vazifa berish» tugmasini qayta bosing.");
  }
  if (action === 'who' && session.step === 'assign_who') {
    const assignee = await Employee.findById(value);
    if (!assignee || !(await Employee.canAssignTo(employee, assignee.id))) return ctx.reply("Bu xodimga vazifa bera olmaysiz.");
    setSession(ctx.from.id, { step: 'assign_title', data: { assigneeId: assignee.id, assigneeName: assignee.fullName } });
    await ctx.editMessageText(`👤 Ijrochi: <b>${escapeHtml(assignee.fullName)}</b>`, { parse_mode: 'HTML' }).catch(() => {});
    return ctx.reply('✏️ <b>2/5.</b> Vazifa sarlavhasini yozing:', { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } });
  }
  if (action === 'skip' && session.step === 'assign_desc') {
    setSession(ctx.from.id, { step: 'assign_deadline', data: { ...session.data, description: null } });
    await ctx.editMessageReplyMarkup().catch(() => {});
    return ctx.reply('⏰ <b>4/5.</b> Deadline qachon?', { parse_mode: 'HTML', reply_markup: deadlineKeyboard() });
  }
  if (action === 'dl' && session.step === 'assign_deadline') {
    if (value === 'custom') {
      setSession(ctx.from.id, { step: 'assign_date', data: session.data });
      return ctx.reply('📅 Sanani <b>kun.oy.yil</b> yoki <b>kun.oy.yil soat:daqiqa</b> ko\'rinishida yozing.\nMasalan: <code>15.10.2026</code> yoki <code>15.10.2026 14:00</code>', { parse_mode: 'HTML' });
    }
    const deadline = presetDeadline(value);
    setSession(ctx.from.id, { step: 'assign_priority', data: { ...session.data, deadline } });
    await ctx.editMessageText(`⏰ Deadline: <b>${formatDateTime(deadline)}</b>`, { parse_mode: 'HTML' }).catch(() => {});
    return ctx.reply('❗ <b>5/5.</b> Muhimlik darajasini tanlang:', { parse_mode: 'HTML', reply_markup: priorityKeyboard() });
  }
  if (action === 'pr' && session.step === 'assign_priority') {
    await ctx.editMessageReplyMarkup().catch(() => {});
    return finishAssign(ctx, employee, session, value);
  }
  return null;
}

async function handleAssignText(ctx, employee, session, text) {
  if (session.step === 'assign_title') {
    if (text.length < 3) return ctx.reply("Sarlavha juda qisqa. Qaytadan yozing:");
    setSession(ctx.from.id, { step: 'assign_desc', data: { ...session.data, title: text.slice(0, 200) } });
    return ctx.reply('📝 <b>3/5.</b> Vazifa tavsifini yozing (nima qilish kerak, natija qanday bo\'lishi kerak):', {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text("⏭ O'tkazib yuborish", 'a:skip').row().text('✖️ Bekor qilish', 'a:cancel'),
    });
  }
  if (session.step === 'assign_desc') {
    setSession(ctx.from.id, { step: 'assign_deadline', data: { ...session.data, description: text.slice(0, 3000) } });
    return ctx.reply('⏰ <b>4/5.</b> Deadline qachon?', { parse_mode: 'HTML', reply_markup: deadlineKeyboard() });
  }
  if (session.step === 'assign_date' || session.step === 'assign_deadline') {
    const deadline = parseDateInput(text);
    if (!deadline) return ctx.reply("Sana noto'g'ri. Masalan: 15.10.2026 yoki 15.10.2026 14:00");
    if (deadline < new Date()) return ctx.reply("Bu sana o'tib ketgan. Kelajakdagi sanani yozing:");
    setSession(ctx.from.id, { step: 'assign_priority', data: { ...session.data, deadline } });
    return ctx.reply(`⏰ Deadline: <b>${formatDateTime(deadline)}</b>\n\n❗ <b>5/5.</b> Muhimlik darajasini tanlang:`, {
      parse_mode: 'HTML',
      reply_markup: priorityKeyboard(),
    });
  }
  return null;
}

/* ======================== Vazifa tugmalari ======================== */

async function showTask(ctx, employee, task) {
  const isAssignee = task.assigneeId === employee.id;
  const isAssigner = task.assignerId === employee.id || employee.role === 'DIRECTOR';
  if (!isAssignee && !isAssigner) {
    const visible = await Employee.getVisibleEmployeeIds(employee);
    if (!visible.includes(task.assigneeId)) return ctx.reply("Bu vazifani ko'rish huquqingiz yo'q.");
  }
  let keyboard;
  if (isAssignee && Task.ACTIVE_STATUSES.includes(task.status)) keyboard = notify.executorKeyboard(task);
  else if (isAssigner && task.status === 'BAJARILDI' && !task.qualityScore) keyboard = notify.rateKeyboard(task.id);
  return ctx.reply(notify.taskCard(task), { parse_mode: 'HTML', reply_markup: keyboard });
}

async function refreshExecutorMarkup(ctx, task) {
  const markup = Task.ACTIVE_STATUSES.includes(task.status) ? notify.executorKeyboard(task) : undefined;
  await ctx.editMessageReplyMarkup({ reply_markup: markup }).catch(() => {});
}

async function handleTaskCallback(ctx, employee, action, id, value) {
  const task = await Task.getById(id);
  if (!task) return ctx.reply('Vazifa topilmadi.');

  switch (action) {
    case 'view':
      return showTask(ctx, employee, task);
    case 'acc': {
      const updated = await Task.accept(task, employee);
      await refreshExecutorMarkup(ctx, updated);
      await notify.statusChanged(updated, 'accepted');
      return ctx.reply(`👌 "${updated.title}" vazifasi qabul qilindi. Deadline: ${formatDateTime(updated.deadline)} (${timeLeft(updated.deadline)})`);
    }
    case 'prg':
      if (task.assigneeId !== employee.id) throw new Task.TaskError('Bu amalni faqat ijrochi bajara oladi');
      return ctx.editMessageReplyMarkup({ reply_markup: notify.progressKeyboard(task.id) }).catch(() => ctx.reply('Bajarilish foizini tanlang:', { reply_markup: notify.progressKeyboard(task.id) }));
    case 'p': {
      const updated = await Task.setProgress(task, employee, value);
      await refreshExecutorMarkup(ctx, updated);
      await notify.statusChanged(updated, 'progress');
      return ctx.reply(`⏳ "${updated.title}": ${updated.progress}% bajarildi deb belgilandi.`);
    }
    case 'done': {
      const updated = await Task.complete(task, employee);
      await refreshExecutorMarkup(ctx, updated);
      await notify.taskCompleted(updated);
      return ctx.reply(`✔️ Ajoyib! "${updated.title}" bajarildi deb belgilandi. Beruvchi baholaydi.`);
    }
    case 'fail':
      if (task.assigneeId !== employee.id) throw new Task.TaskError('Bu amalni faqat ijrochi bajara oladi');
      return ctx.reply('❌ Nima uchun bajara olmaysiz? Sababni tanlang (majburiy):', { reply_markup: notify.reasonKeyboard(task.id, 'fr') });
    case 'fr':
    case 'or': {
      const reason = notify.REASON_CODES[Number(value)];
      if (!reason) return null;
      if (task.assigneeId !== employee.id) throw new Task.TaskError('Bu amalni faqat ijrochi bajara oladi');
      if (reason === 'BOSHQA') {
        setSession(ctx.from.id, { step: 'reason_text', data: { taskId: task.id, mode: action } });
        return ctx.reply('✍️ Sababni yozing:');
      }
      await ctx.editMessageReplyMarkup().catch(() => {});
      return applyReason(ctx, employee, task, action, reason, null);
    }
    case 'rate': {
      const updated = await Task.rate(task, employee, value);
      await ctx.editMessageReplyMarkup().catch(() => {});
      await notify.taskRated(updated);
      return ctx.reply(`⭐ "${updated.title}" vazifasiga ${updated.qualityScore} baho qo'yildi.`);
    }
    case 'ret':
      if (task.assignerId !== employee.id && employee.role !== 'DIRECTOR') throw new Task.TaskError('Bu amalni faqat vazifa beruvchi bajara oladi');
      if (task.status !== 'BAJARILDI') throw new Task.TaskError('Faqat bajarilgan vazifani qaytarish mumkin');
      setSession(ctx.from.id, { step: 'return_comment', data: { taskId: task.id } });
      return ctx.reply('🔁 Vazifani nima uchun qaytaryapsiz? Izoh yozing (ijrochiga yuboriladi):');
    case 'file':
      if (task.assigneeId !== employee.id) throw new Task.TaskError('Fayl faqat ijrochi tomonidan biriktiriladi');
      setSession(ctx.from.id, { step: 'await_file', data: { taskId: task.id } });
      return ctx.reply(`📎 "${task.title}" vazifasi uchun fayl yoki rasmni yuboring:`);
    default:
      return null;
  }
}

async function applyReason(ctx, employee, task, mode, reason, text) {
  if (mode === 'fr') {
    const updated = await Task.fail(task, employee, reason, text);
    await notify.statusChanged(updated, 'failed');
    return ctx.reply('Sabab qayd etildi va rahbaringizga yuborildi.');
  }
  const updated = await Task.setOverdueReason(task, employee, reason, text);
  await notify.statusChanged(updated, 'overdueReason');
  return ctx.reply('Kechikish sababi qayd etildi. Iltimos, vazifani imkon qadar tezroq yakunlang.', {
    reply_markup: Task.ACTIVE_STATUSES.includes(updated.status) ? notify.executorKeyboard(updated) : undefined,
  });
}

/* ======================== Fayllar va sklad ======================== */

function isSpreadsheet(fileName) {
  const lower = String(fileName || '').toLowerCase();
  return stockService.ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

async function downloadTelegramFile(fileId) {
  const file = await bot.api.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Faylni yuklab bo\'lmadi');
  return Buffer.from(await response.arrayBuffer());
}

async function handleStockFile(ctx, employee, document) {
  if (document.file_size && document.file_size > config.maxUploadBytes) {
    return ctx.reply("❗ Fayl hajmi 20 MB dan oshmasligi kerak.");
  }
  const [warehouseInput, responsibleInput] = String(ctx.message.caption || '')
    .split(/[;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  await ctx.reply('⏳ Fayl o\'qilmoqda...');
  try {
    const buffer = await downloadTelegramFile(document.file_id);
    const result = await stockService.processStockFile({
      buffer,
      fileName: document.file_name,
      warehouse: warehouseInput,
      responsible: responsibleInput || (employee.isStockResponsible ? employee.fullName : null),
    });
    const { check, top, itemsWithDiff } = result;
    const lines = [
      '📦 <b>Sverka natijasi</b>',
      '',
      `🏬 Sklad: ${escapeHtml(check.warehouse)}`,
      `👤 Mas'ul: ${escapeHtml(check.responsible)}`,
      `📅 Sana: ${formatDate(check.checkDate)}`,
      `🔢 Tovarlar: ${check.itemCount} ta, farqli: ${itemsWithDiff} ta`,
      '',
      `🔻 Kamomad: <b>${formatMoney(check.shortageSum)}</b>`,
      `🔺 Ortiqcha: <b>${formatMoney(check.surplusSum)}</b>`,
      `⚖️ Sof farq: <b>${formatMoney(check.totalDiff)}</b>`,
    ];
    if (top.length) {
      lines.push('', '<b>Eng katta 5 ta farq:</b>');
      top.forEach((item, i) => {
        lines.push(`${i + 1}. ${escapeHtml(item.name)}: ${item.diffQty > 0 ? '+' : ''}${item.diffQty} dona = ${formatMoney(item.diffSum)}`);
      });
    } else {
      lines.push('', '✅ Farq topilmadi.');
    }
    lines.push('', "📊 To'liq natija Web Dashboard'ning «Sklad sverka» bo'limida.");
    if (!warehouseInput) lines.push("💡 Maslahat: fayl izohiga <i>Sklad nomi; Mas'ul ism</i> deb yozsangiz, ular ham saqlanadi.");
    return ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  } catch (error) {
    if (error instanceof stockService.StockError) return ctx.reply(`❗ ${error.message}`);
    console.error('[BOT] Sverka xatosi:', error);
    return ctx.reply("❗ Faylni qayta ishlashda xatolik yuz berdi. Qayta urinib ko'ring.");
  }
}

async function attachFile(ctx, employee, taskId, fileInfo) {
  const task = await Task.getById(taskId);
  if (!task || task.assigneeId !== employee.id) return ctx.reply('Vazifa topilmadi.');
  const saved = await Task.addFile({ taskId: task.id, uploadedBy: employee.id, deadline: task.deadline, ...fileInfo });
  clearSession(ctx.from.id);
  await notify.forwardFile(task, saved, employee.fullName);
  return ctx.reply(
    `📎 Fayl "${task.title}" vazifasiga biriktirildi va beruvchiga yuborildi.${saved.isLate ? "\n⚠️ Fayl deadline'dan keyin yuklandi." : ''}`,
    { reply_markup: Task.ACTIVE_STATUSES.includes(task.status) ? notify.executorKeyboard(task) : undefined },
  );
}

async function handleIncomingFile(ctx) {
  const employee = await requireEmployee(ctx);
  if (!employee) return null;
  const message = ctx.message;
  const session = getSession(ctx.from.id);

  let fileInfo;
  if (message.document) {
    fileInfo = { fileId: message.document.file_id, fileName: message.document.file_name || 'hujjat', fileType: 'document' };
  } else if (message.photo) {
    const photo = message.photo[message.photo.length - 1];
    fileInfo = { fileId: photo.file_id, fileName: `rasm_${formatDate(new Date())}.jpg`, fileType: 'photo' };
  } else if (message.video) {
    fileInfo = { fileId: message.video.file_id, fileName: message.video.file_name || 'video.mp4', fileType: 'document' };
  } else {
    return null;
  }

  if (session?.step === 'await_file') return attachFile(ctx, employee, session.data.taskId, fileInfo);

  const canUploadStock = employee.role === 'DIRECTOR' || employee.isStockResponsible;
  if (message.document && canUploadStock && isSpreadsheet(message.document.file_name)) {
    return handleStockFile(ctx, employee, message.document);
  }

  const active = await Task.activeForAssignee(employee.id);
  if (!active.length) {
    return ctx.reply(canUploadStock ? "Sizda faol vazifa yo'q. Sverka uchun Excel (.xlsx) fayl yuboring." : "Sizda faol vazifa yo'q, fayl biriktirib bo'lmaydi.");
  }
  if (active.length === 1) return attachFile(ctx, employee, active[0].id, fileInfo);

  setSession(ctx.from.id, { step: 'choose_file_task', data: { fileInfo } });
  const kb = new InlineKeyboard();
  active.slice(0, 20).forEach((t) => kb.text(`#${t.id} ${t.title.slice(0, 30)}`, `f:${t.id}`).row());
  return ctx.reply('📎 Bu faylni qaysi vazifaga biriktiramiz?', { reply_markup: kb });
}

/* ======================== AI ======================== */

async function runAiReport(ctx, module) {
  await ctx.reply(`⏳ «${MODULE_LABELS[module]}» bo'yicha AI tahlil tayyorlanmoqda, 1–2 daqiqa kuting...`);
  await ctx.replyWithChatAction('typing').catch(() => {});
  const result = await ai.generateReport(module);
  if (!result.ok) return ctx.reply(result.message);
  return notify.sendLong(ctx.chat.id, `🤖 ${MODULE_LABELS[module]} — AI tahlil\n\n${result.report.text}`);
}

function draftCard(draft) {
  const d = draft.data;
  const lines = [
    '📝 <b>Vazifa loyihasi</b> — tekshirib, tasdiqlang:',
    '',
    `👷 Ijrochi: <b>${escapeHtml(d.assigneeName)}</b>`,
    `📌 <b>${escapeHtml(d.title)}</b>`,
  ];
  if (d.description) lines.push(`<i>${escapeHtml(d.description)}</i>`);
  lines.push(`⏰ Deadline: ${formatDateTime(d.deadline)} (${timeLeft(d.deadline)})`, `${PRIORITY_ICONS[d.priority]} Muhimlik: ${PRIORITY_LABELS[d.priority]}`, `🎯 KPI og'irligi: ${Task.normalizeWeight(d.kpiWeight, d.priority)}/5`);
  return lines.join('\n');
}

async function runAgent(ctx, employee, text) {
  if (!ai.isEnabled()) return ctx.reply(ai.aiDisabledMessage());
  await ctx.replyWithChatAction('typing').catch(() => {});
  const typing = setInterval(() => ctx.replyWithChatAction('typing').catch(() => {}), 4500);
  let result;
  try {
    result = await agent.run(employee, text);
  } finally {
    clearInterval(typing);
  }
  if (result.text) await notify.sendLong(ctx.chat.id, result.text);
  for (const draft of result.drafts || []) {
    await ctx.reply(draftCard(draft), {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('✅ Yuborish', `ai:ok:${draft.id}`).text('✖️ Bekor qilish', `ai:no:${draft.id}`),
    });
  }
  return null;
}

async function handleDraftCallback(ctx, employee, action, id) {
  const draft = agent.getDraft(id);
  if (!draft || draft.actorId !== employee.id) {
    await ctx.editMessageReplyMarkup().catch(() => {});
    return ctx.reply("Bu loyiha eskirgan. AI'ga qaytadan yozing.");
  }
  agent.removeDraft(id);
  if (action === 'no') {
    await ctx.editMessageText(`${draftCard(draft)}\n\n✖️ <b>Bekor qilindi</b>`, { parse_mode: 'HTML' }).catch(() => {});
    return null;
  }
  const d = draft.data;
  if (!(await Employee.canAssignTo(employee, d.assigneeId))) return ctx.reply("Bu xodimga vazifa bera olmaysiz.");
  const task = await Task.createTask({
    title: d.title,
    description: d.description,
    assignerId: employee.id,
    assigneeId: d.assigneeId,
    deadline: d.deadline,
    priority: d.priority,
    kpiWeight: d.kpiWeight,
  });
  await notify.taskCreated(task);
  const warn = task.assignee.telegramId ? '' : "\n⚠️ Ijrochi hali botga ulanmagan — /start bosgach xabarni oladi.";
  await ctx.editMessageText(`${draftCard(draft)}\n\n✅ <b>Yuborildi</b> (#${task.id})${warn}`, { parse_mode: 'HTML' }).catch(() => {});
  return null;
}

async function sendBrief(ctx, employee) {
  await ctx.replyWithChatAction('typing').catch(() => {});
  const text = await brief.build(employee);
  return notify.send(ctx.chat.id, text);
}

async function answerDirectorQuestion(ctx, question) {
  await ctx.reply('⏳ Savolingiz tahlil qilinmoqda...');
  await ctx.replyWithChatAction('typing').catch(() => {});
  const result = await ai.askQuestion(question);
  if (!result.ok) return ctx.reply(result.message);
  return notify.sendLong(ctx.chat.id, result.report.text);
}

/* ======================== Asosiy yo'naltirgichlar ======================== */

async function handleText(ctx) {
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) return null;
  const employee = await requireEmployee(ctx);
  if (!employee) return null;

  const isMenuButton = Object.values(BTN).includes(text);
  const session = getSession(ctx.from.id);
  if (isMenuButton && session) clearSession(ctx.from.id);

  if (text === BTN.APP) return openApp(ctx);
  if (text === BTN.PC && employee.role !== 'MIDDLE') return openPanel(ctx, employee);
  if (text === BTN.MINE) return showMyTasks(ctx, employee);
  if (text === BTN.GIVEN && employee.role !== 'MIDDLE') return showGivenTasks(ctx, employee);
  if (text === BTN.ASSIGN) return startAssign(ctx, employee);
  if (text === BTN.REPORT && employee.role !== 'MIDDLE') return showReport(ctx, employee);

  if (session && !isMenuButton) {
    if (session.step.startsWith('assign_')) return handleAssignText(ctx, employee, session, text);
    if (session.step === 'reason_text') {
      const task = await Task.getById(session.data.taskId);
      clearSession(ctx.from.id);
      if (!task) return ctx.reply('Vazifa topilmadi.');
      return applyReason(ctx, employee, task, session.data.mode, 'BOSHQA', text);
    }
    if (session.step === 'return_comment') {
      const task = await Task.getById(session.data.taskId);
      clearSession(ctx.from.id);
      if (!task) return ctx.reply('Vazifa topilmadi.');
      const updated = await Task.returnForRework(task, employee, text);
      await notify.taskReturned(updated, text);
      return ctx.reply(`🔁 "${updated.title}" qayta ishlashga qaytarildi. Ijrochiga xabar yuborildi.`);
    }
    if (session.step === 'await_file') return ctx.reply('📎 Fayl yoki rasm yuboring. Bekor qilish uchun menyudagi istalgan tugmani bosing.');
  }

  if (employee.role === 'DIRECTOR' || employee.role === 'TOP') return runAgent(ctx, employee, text);
  return ctx.reply('Iltimos, pastdagi menyudan foydalaning 👇', { reply_markup: mainMenu(employee) });
}

async function handleCallback(ctx) {
  const data = ctx.callbackQuery.data || '';
  const employee = await currentEmployee(ctx);
  if (!employee) {
    await ctx.answerCallbackQuery({ text: "Avval /start bosib, raqamingizni tasdiqlang.", show_alert: true });
    return null;
  }
  const [scope, action, id, value] = data.split(':');
  try {
    if (scope === 'a') {
      await ctx.answerCallbackQuery();
      return await handleAssignCallback(ctx, employee, action, id);
    }
    if (scope === 't') {
      await ctx.answerCallbackQuery();
      return await handleTaskCallback(ctx, employee, action, id, value);
    }
    if (scope === 'f') {
      await ctx.answerCallbackQuery();
      const session = getSession(ctx.from.id);
      if (!session || session.step !== 'choose_file_task') return ctx.reply('Faylni qaytadan yuboring.');
      await ctx.editMessageReplyMarkup().catch(() => {});
      return await attachFile(ctx, employee, Number(action), session.data.fileInfo);
    }
    if (scope === 'ai') {
      await ctx.answerCallbackQuery();
      return await handleDraftCallback(ctx, employee, action, id);
    }
    if (scope === 'r' && action === 'ai') {
      await ctx.answerCallbackQuery();
      if (employee.role !== 'DIRECTOR') return ctx.reply("AI tahlil faqat direktor uchun.");
      return await runAiReport(ctx, id);
    }
    return ctx.answerCallbackQuery();
  } catch (error) {
    if (error instanceof Task.TaskError) return ctx.reply(`❗ ${error.message}`);
    throw error;
  }
}

async function handleBriefCommand(ctx) {
  const employee = await requireEmployee(ctx);
  if (!employee) return null;
  if (employee.role === 'MIDDLE') return ctx.reply('Brifing faqat rahbarlar uchun.');
  return sendBrief(ctx, employee);
}

async function handleResetCommand(ctx) {
  const employee = await requireEmployee(ctx);
  if (!employee) return null;
  agent.resetConversation(employee.id);
  return ctx.reply("🧹 AI bilan suhbat tozalandi. Yangi mavzuda yozishingiz mumkin.");
}

async function handlePanelCommand(ctx) {
  const employee = await requireEmployee(ctx);
  if (!employee) return null;
  if (employee.role === 'MIDDLE') return ctx.reply("Kompyuter paneli direktor va bo'lim boshliqlari uchun.");
  return openPanel(ctx, employee);
}

module.exports = {
  handlePanelCommand,
  handleBriefCommand,
  handleResetCommand,
  handleStart,
  handleContact,
  handleText,
  handleCallback,
  handleIncomingFile,
  mainMenu,
};
