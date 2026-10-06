const crypto = require('crypto');
const { prisma } = require('../database/connection');
const { config } = require('../config/default');
const ai = require('./ai.service');
const analytics = require('./analytics.service');
const notify = require('./notify.service');
const Employee = require('../models/Employee');
const Task = require('../models/Task');
const AiReport = require('../models/AiReport');
const { ROLE_LABELS, STATUS_LABELS, PRIORITY_LABELS, REASON_LABELS } = require('../utils/labels');
const { formatDateTime, timeLeft, endOfDay, parts, tashkentDate } = require('../utils/format');

const MAX_STEPS = 8;
const HISTORY_TTL = 20 * 60 * 1000;
const MAX_HISTORY = 24;

/* Suhbat tarixi (keyingi savollar oldingisiga bog'lanishi uchun) */
const conversations = new Map();
/* Tasdiqlanishini kutayotgan vazifa loyihalari */
const drafts = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of conversations) if (now - value.updatedAt > HISTORY_TTL) conversations.delete(key);
  for (const [key, value] of drafts) if (now - value.createdAt > 24 * 60 * 60 * 1000) drafts.delete(key);
}, 10 * 60 * 1000).unref();

const TOOLS = [
  {
    name: 'find_employees',
    description:
      "Xodimlarni ism, familiya, lavozim yoki bo'lim bo'yicha qidiradi. Vazifa berishdan yoki xodim haqida ma'lumot olishdan oldin xodimning id raqamini aniqlash uchun ishlating. Bo'sh so'rov barcha xodimlarni qaytaradi.",
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: "Ism, familiya, lavozim yoki bo'lim (bir qismi bo'lsa ham bo'ladi)" } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_task_draft',
    description:
      "Yangi vazifa loyihasini tayyorlaydi. Vazifa darhol yuborilmaydi: foydalanuvchiga tasdiqlash tugmasi bilan ko'rsatiladi. employee_id ni avval find_employees orqali aniqlang. Deadline aytilmagan bo'lsa, ertaga soat 18:00 ni oling.",
    input_schema: {
      type: 'object',
      properties: {
        employee_id: { type: 'integer', description: 'Ijrochi xodimning id raqami' },
        title: { type: 'string', description: 'Qisqa va aniq sarlavha (buyruq shaklida)' },
        description: { type: 'string', description: "Nima qilish kerak va natija qanday bo'lishi kerak. Aniq va tushunarli yozing." },
        deadline: { type: 'string', description: "Toshkent vaqti bo'yicha, format: YYYY-MM-DD HH:mm" },
        priority: { type: 'string', enum: ['PAST', 'ORTA', 'YUQORI'] },
        kpi_weight: { type: 'integer', minimum: 1, maximum: 5, description: "KPI og'irligi 1–5 (5 — eng muhim). Rahbar aytmasa, bermang." },
      },
      required: ['employee_id', 'title', 'description', 'deadline', 'priority'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_tasks',
    description: "Vazifalar ro'yxatini qaytaradi. Holat bo'yicha filtr: overdue (muddati o'tgan), due_today (bugun tugaydigan), active (faol), waiting_rating (bajarilgan, baholanmagan), recent_done (oxirgi 7 kunda bajarilgan), failed (bajarilmagan).",
    input_schema: {
      type: 'object',
      properties: {
        filter: { type: 'string', enum: ['overdue', 'due_today', 'active', 'waiting_rating', 'recent_done', 'failed'] },
        employee_id: { type: 'integer', description: "Faqat shu xodimning vazifalari (ixtiyoriy)" },
      },
      required: ['filter'],
      additionalProperties: false,
    },
  },
  {
    name: 'send_reminders',
    description: "Ijrochilarga Telegram orqali eslatma yuboradi. scope: overdue (muddati o'tgan vazifalar) yoki due_today (bugun tugaydigan). Faqat foydalanuvchi aniq so'raganda ishlating.",
    input_schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['overdue', 'due_today'] },
        employee_id: { type: 'integer', description: 'Faqat shu xodimga (ixtiyoriy)' },
      },
      required: ['scope'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_employee_report',
    description: "Bitta xodimning faollik bali, muddatida bajarish ulushi, sifat bahosi, haftalik trendi va oxirgi vazifalarini qaytaradi.",
    input_schema: {
      type: 'object',
      properties: { employee_id: { type: 'integer' } },
      required: ['employee_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_company_summary',
    description:
      "Kompaniya bo'yicha hisoblangan ko'rsatkichlarni qaytaradi: VAZIFALAR (ijro va sabablar), FAOLLIK (xodimlar reytingi), SKLAD (sverkalar va kamomadlar), MOLIYA (reja/fakt, maqsadlar, qarorlar), UMUMIY (hammasi qisqacha).",
    input_schema: {
      type: 'object',
      properties: { module: { type: 'string', enum: ['VAZIFALAR', 'FAOLLIK', 'SKLAD', 'MOLIYA', 'UMUMIY'] } },
      required: ['module'],
      additionalProperties: false,
    },
  },
];

function nowText() {
  const p = parts(new Date());
  const days = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
  return `${formatDateTime(new Date())} (${days[p.weekday]}), Toshkent vaqti`;
}

function systemPrompt(actor) {
  return `${ai.BASE_SYSTEM}

SEN ENDI AI AGENTSAN: rahbarning shaxsiy yordamchisi. Sen nafaqat tahlil qilasan, balki asboblar (tools) orqali ish ham bajarasan.

Hozirgi vaqt: ${nowText()}.
Sen bilan gaplashayotgan foydalanuvchi: ${actor.fullName}, ${ROLE_LABELS[actor.role]}${actor.position ? `, ${actor.position}` : ''}.
${actor.role === 'TOP' ? "U faqat o'ziga bo'ysunuvchi xodimlarni ko'ra oladi va faqat ularga vazifa bera oladi." : 'U direktor: barcha xodimlarni ko\'ra oladi.'}

ISH TARTIBI:
• Foydalanuvchi vazifa berishni so'rasa: avval find_employees bilan xodimni toping, keyin create_task_draft chaqiring. Bir nechta mos xodim chiqsa yoki hech kim chiqmasa — taxmin qilmang, foydalanuvchidan aniqlashtiring. "ertaga", "juma kuni", "3 kundan keyin" kabi iboralarni hozirgi vaqtdan hisoblang.
• Vazifa tavsifini aniq va o'lchanadigan qilib yozing (nima, qanday natija, qaysi formatda) — "Topshiriq noaniq" degan sabab chiqmasin.
• Eslatma yuborishni faqat foydalanuvchi aniq so'raganda bajaring.
• Tahliliy savollarda tegishli asbobdan ma'lumot oling va javobni "📊 Tahlil", "💡 Xulosa", "✅ Tavsiyalar" qismlarida bering.
• Bajarilgan ishdan keyin javob qisqa bo'lsin (1–4 gap): nima qilindi va keyingi qadam. Bu holatda uch qismli format shart emas.
• Hech qanday raqam, ism yoki faktni o'ylab topma — faqat asboblar qaytargan ma'lumotga tayan.`;
}

/* ---------------- Asboblar ---------------- */

async function visibleEmployees(actor) {
  if (actor.role === 'DIRECTOR') return prisma.employee.findMany({ where: { isActive: true } });
  const ids = await Employee.getSubordinateIds(actor.id);
  return prisma.employee.findMany({ where: { isActive: true, id: { in: ids } } });
}

function short(e) {
  return { id: e.id, ism: e.fullName, lavozim: e.position, bolim: e.department, rol: ROLE_LABELS[e.role], telegram_ulangan: Boolean(e.telegramId) };
}

function taskShort(t, now = new Date()) {
  return {
    id: t.id,
    vazifa: t.title,
    ijrochi: t.assignee?.fullName,
    beruvchi: t.assigner?.fullName,
    deadline: formatDateTime(t.deadline),
    qolgan_vaqt: Task.ACTIVE_STATUSES.includes(t.status) ? timeLeft(t.deadline, now) : undefined,
    holat: Task.isOverdue(t, now) ? "Muddati o'tgan" : STATUS_LABELS[t.status],
    muhimlik: PRIORITY_LABELS[t.priority],
    bajarilish: `${t.progress}%`,
    baho: t.qualityScore || undefined,
    sabab: t.failReason ? REASON_LABELS[t.failReason] + (t.failReasonText ? ` (${t.failReasonText})` : '') : undefined,
  };
}

function parseDeadline(text) {
  const m = String(text || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const d = tashkentDate(Number(m[1]), Number(m[2]), Number(m[3]), m[4] !== undefined ? Number(m[4]) : 18, m[5] !== undefined ? Number(m[5]) : 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function scopedTaskWhere(actor, employeeId) {
  if (employeeId) {
    const visible = await Employee.getVisibleEmployeeIds(actor);
    if (!visible.includes(Number(employeeId))) return null;
    return { assigneeId: Number(employeeId) };
  }
  if (actor.role === 'DIRECTOR') return {};
  return { assigneeId: { in: await Employee.getSubordinateIds(actor.id) } };
}

const HANDLERS = {
  async find_employees(actor, { query }) {
    const list = await visibleEmployees(actor);
    const q = String(query || '').toLowerCase().trim();
    const words = q.split(/\s+/).filter(Boolean);
    const found = list.filter((e) => {
      const hay = `${e.fullName} ${e.position || ''} ${e.department || ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    return { topildi: found.length, xodimlar: found.slice(0, 25).map(short) };
  },

  async create_task_draft(actor, input, run) {
    const employee = await Employee.findById(input.employee_id);
    if (!employee || !employee.isActive) return { xato: 'Bunday xodim topilmadi' };
    if (!(await Employee.canAssignTo(actor, employee.id))) return { xato: "Bu xodimga vazifa berish huquqi yo'q" };
    const deadline = parseDeadline(input.deadline);
    if (!deadline) return { xato: "Deadline formati noto'g'ri, YYYY-MM-DD HH:mm bo'lishi kerak" };
    if (deadline < new Date()) return { xato: "Deadline o'tib ketgan vaqt bo'lmasligi kerak" };
    const priority = ['PAST', 'ORTA', 'YUQORI'].includes(input.priority) ? input.priority : 'ORTA';
    const id = crypto.randomBytes(5).toString('hex');
    const draft = {
      id,
      actorId: actor.id,
      createdAt: Date.now(),
      data: { assigneeId: employee.id, assigneeName: employee.fullName, title: String(input.title).slice(0, 200), description: String(input.description || '').slice(0, 3000), deadline, priority, kpiWeight: input.kpi_weight },
    };
    drafts.set(id, draft);
    run.drafts.push(draft);
    return { holat: "Loyiha tayyor. Foydalanuvchiga tasdiqlash tugmasi bilan ko'rsatiladi; u tasdiqlagach vazifa yuboriladi.", ijrochi: employee.fullName, deadline: formatDateTime(deadline) };
  },

  async list_tasks(actor, { filter, employee_id: employeeId }) {
    const scope = await scopedTaskWhere(actor, employeeId);
    if (!scope) return { xato: "Bu xodimning vazifalarini ko'rish huquqi yo'q" };
    const now = new Date();
    const where = { ...scope };
    if (filter === 'overdue') Object.assign(where, { status: { in: Task.ACTIVE_STATUSES }, deadline: { lt: now } });
    if (filter === 'due_today') Object.assign(where, { status: { in: Task.ACTIVE_STATUSES }, deadline: { gte: now, lte: endOfDay(now) } });
    if (filter === 'active') Object.assign(where, { status: { in: Task.ACTIVE_STATUSES } });
    if (filter === 'waiting_rating') Object.assign(where, { status: 'BAJARILDI', qualityScore: null });
    if (filter === 'recent_done') Object.assign(where, { status: 'BAJARILDI', completedAt: { gte: new Date(now.getTime() - 7 * 86400000) } });
    if (filter === 'failed') Object.assign(where, { status: 'BAJARILMADI' });
    const tasks = await prisma.task.findMany({ where, include: Task.withPeople, orderBy: { deadline: 'asc' }, take: 40 });
    return { jami: tasks.length, vazifalar: tasks.map((t) => taskShort(t, now)) };
  },

  async send_reminders(actor, { scope, employee_id: employeeId }) {
    const base = await scopedTaskWhere(actor, employeeId);
    if (!base) return { xato: "Bu xodimga eslatma yuborish huquqi yo'q" };
    const now = new Date();
    const where = { ...base, status: { in: Task.ACTIVE_STATUSES } };
    where.deadline = scope === 'overdue' ? { lt: now } : { gte: now, lte: endOfDay(now) };
    const tasks = await prisma.task.findMany({ where, include: Task.withPeople, take: 100 });
    let sent = 0;
    let skipped = 0;
    for (const task of tasks) {
      if (!task.assignee.telegramId) {
        skipped += 1;
        continue;
      }
      const head = scope === 'overdue' ? "🚨 <b>Rahbaringiz eslatmoqda: vazifa muddati o'tgan</b>" : '⏰ <b>Rahbaringiz eslatmoqda: vazifa bugun tugaydi</b>';
      const ok = await notify.send(task.assignee.telegramId, `${head}\n\n${notify.taskCard(task)}`, { reply_markup: notify.executorKeyboard(task) });
      if (ok) sent += 1;
      else skipped += 1;
    }
    return { yuborildi: sent, yuborilmadi_botga_ulanmagan: skipped, vazifalar_soni: tasks.length };
  },

  async get_employee_report(actor, { employee_id: employeeId }) {
    const visible = await Employee.getVisibleEmployeeIds(actor);
    if (!visible.includes(Number(employeeId))) return { xato: "Bu xodim ma'lumotini ko'rish huquqi yo'q" };
    const employee = await Employee.findById(employeeId);
    if (!employee) return { xato: 'Xodim topilmadi' };
    const [m30, m90, trend, tasks] = await Promise.all([
      analytics.employeeMetrics(employee.id, 30),
      analytics.employeeMetrics(employee.id, 90),
      analytics.employeeTrend(employee.id, 6),
      prisma.task.findMany({ where: { assigneeId: employee.id }, include: Task.withPeople, orderBy: { deadline: 'desc' }, take: 12 }),
    ]);
    const fmt = (m) => ({
      ball: m.score,
      holat: m.status.label,
      vazifalar: m.total,
      bajarildi: m.done,
      bajarilmadi: m.failed,
      muddati_otgan: m.overdue,
      muddatida_bajarish: m.onTimeRate === null ? null : `${m.onTimeRate}%`,
      ortacha_sifat: m.avgQuality,
      qabul_qilish_soat: m.avgAcceptHours,
      ortacha_kechikish_kun: m.avgDelayDays,
      qaytarilganlar: m.returns,
    });
    return {
      xodim: short(employee),
      oxirgi_30_kun: fmt(m30),
      oxirgi_90_kun: fmt(m90),
      haftalik_ball: trend.weekly.map((w) => ({ hafta: w.week, ball: w.score })),
      oxirgi_vazifalar: tasks.map((t) => taskShort(t)),
    };
  },

  async get_company_summary(actor, { module }) {
    if (actor.role !== 'DIRECTOR') {
      if (module !== 'VAZIFALAR' && module !== 'FAOLLIK') return { xato: "Bu ma'lumot faqat direktor uchun" };
      const ids = await Employee.getSubordinateIds(actor.id);
      const rows = await analytics.ranking({ days: 30, employeeIds: ids });
      return {
        jamoa_reytingi: rows.map((r) => ({ ism: r.fullName, ball: r.score, holat: r.status.label, muddatida: r.onTimeRate, muddati_otgan: r.overdue, sifat: r.avgQuality })),
      };
    }
    const builder = ai.CONTEXT_BUILDERS[module];
    if (!builder) return { xato: "Noma'lum modul" };
    return builder();
  },
};

async function executeTool(actor, name, input, run) {
  const handler = HANDLERS[name];
  if (!handler) return { xato: `Noma'lum asbob: ${name}` };
  try {
    return await handler(actor, input || {}, run);
  } catch (error) {
    console.error(`[AGENT] ${name} xatosi:`, error.message);
    return { xato: 'Asbobni bajarishda xatolik yuz berdi' };
  }
}

/**
 * Agentni ishga tushiradi. Qaytaradi: { ok, text, drafts, actions }
 */
async function run(actor, userText) {
  if (!ai.isEnabled()) return { ok: false, text: ai.aiDisabledMessage(), drafts: [] };

  const key = String(actor.id);
  let convo = conversations.get(key);
  if (!convo || Date.now() - convo.updatedAt > HISTORY_TTL || convo.messages.length > MAX_HISTORY) {
    convo = { messages: [], updatedAt: Date.now() };
  }
  const messages = [...convo.messages, { role: 'user', content: String(userText).slice(0, 2000) }];
  const state = { drafts: [], actions: [] };

  try {
    for (let step = 0; step < MAX_STEPS; step += 1) {
      const response = await ai.rawCreate({
        model: config.claudeModel,
        max_tokens: 6000,
        system: systemPrompt(actor),
        tools: TOOLS,
        messages,
      });
      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'refusal') {
        return { ok: false, text: "🤖 AI bu so'rovni bajara olmadi. Savolni boshqacha shaklda yozib ko'ring.", drafts: state.drafts };
      }
      if (response.stop_reason === 'pause_turn') continue;

      const toolUses = response.content.filter((b) => b.type === 'tool_use');
      if (response.stop_reason !== 'tool_use' || !toolUses.length) {
        const text = ai.extractText(response) || (state.drafts.length ? 'Vazifa loyihasi tayyor, tasdiqlang.' : 'Bajarildi.');
        conversations.set(key, { messages, updatedAt: Date.now() });
        await AiReport.save({ module: 'UMUMIY', period: 'AI agent', text, question: String(userText).slice(0, 1000) }).catch(() => {});
        return { ok: true, text, drafts: state.drafts, actions: state.actions };
      }

      const results = [];
      for (const block of toolUses) {
        const result = await executeTool(actor, block.name, block.input, state);
        state.actions.push(block.name);
        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result), is_error: Boolean(result && result.xato) });
      }
      messages.push({ role: 'user', content: results });
    }
    conversations.delete(key);
    return { ok: true, text: "Vazifa juda murakkab bo'lib chiqdi. Iltimos, uni qismlarga bo'lib yozing.", drafts: state.drafts };
  } catch (error) {
    console.error('[AGENT] xato:', error.message);
    conversations.delete(key);
    return { ok: false, text: ai.friendlyError(error), drafts: state.drafts };
  }
}

function getDraft(id) {
  return drafts.get(id) || null;
}

function removeDraft(id) {
  drafts.delete(id);
}

function resetConversation(actorId) {
  conversations.delete(String(actorId));
}

module.exports = { run, getDraft, removeDraft, resetConversation, TOOLS, HANDLERS, parseDeadline };
