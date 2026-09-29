const Anthropic = require('@anthropic-ai/sdk');
const { config } = require('../config/default');
const analytics = require('./analytics.service');
const AiReport = require('../models/AiReport');
const { ROLE_LABELS, STATUS_LABELS, REASON_LABELS, VERDICT_LABELS, MODULE_LABELS } = require('../utils/labels');
const { formatMoney, formatDate, formatDateTime, addDays, monthLabel } = require('../utils/format');

const client = config.aiEnabled ? new Anthropic({ apiKey: config.anthropicApiKey, timeout: 180000, maxRetries: 2 }) : null;

const BASE_SYSTEM = `Sen tajribali biznes tahlilchisi va boshqaruv maslahatchisisan. O'zbekistondagi kompaniya direktoriga yordam berasan.

QAT'IY QOIDALAR:
1. Faqat o'zbek tilida, lotin yozuvida yoz.
2. Faqat senga berilgan ma'lumotlarga tayan. Hech qanday raqam, ism yoki faktni o'ylab topma. Agar biror xulosa uchun ma'lumot yetmasa, buni ochiq ayt ("Bu bo'yicha ma'lumot yetarli emas").
3. Pul summalarini "12 500 000 so'm" ko'rinishida, sanalarni kun.oy.yil (masalan 05.09.2026) ko'rinishida yoz.
4. Javob DOIM aynan uch qismdan iborat bo'lsin va sarlavhalar alohida qatorda aynan shunday yozilsin:
📊 Tahlil
💡 Xulosa
✅ Tavsiyalar
5. "Tahlil" qismida eng muhim raqamlar va qonuniyatlarni ko'rsat. "Xulosa" qismida 2–4 gapda asosiy fikrni ayt. "Tavsiyalar" qismida 3–6 ta aniq, bajarsa bo'ladigan tavsiya ber: har birida KIM, NIMA qilishi va QACHONGACHA ekanini yoz.
6. Markdown jadval, # sarlavha va ** belgilarini ishlatma. Ro'yxat uchun "•" belgisidan foydalan. Javob Telegram'da ham o'qilishi kerak, shuning uchun ixcham yoz (taxminan 250–450 so'z).`;

const MODULE_PROMPTS = {
  VAZIFALAR: `${BASE_SYSTEM}

MODUL: VAZIFALAR IJROSI. Vazifalar bajarilishi, kechikishlar, muddati o'tgan vazifalar va bajarilmaslik sabablarini tahlil qil. Qaysi bo'lim yoki xodimda muammo to'planganini, qaysi sabablar tizimli ekanini (masalan "Topshiriq noaniq" ko'p bo'lsa — rahbarlar vazifani aniqroq qo'yishi kerak) aniqlab ber.`,
  FAOLLIK: `${BASE_SYSTEM}

MODUL: XODIMLAR FAOLLIGI. Faollik bali 0–100: muddatida bajarish 30%, qabul qilish tezligi 20%, bajarish tezligi 20%, sifat bahosi 20%, qaytarilganlar uchun jarima 10%. 75+ Faol, 50–74 O'rtacha, 50 dan past Sust. Eng yaxshi va eng sust xodimlarni ism bilan ayt, top va middle management'ni solishtir, haftalik trendga e'tibor ber. Sust xodimlar bo'yicha ularning rahbari nima qilishi kerakligini tavsiya qil.`,
  SKLAD: `${BASE_SYSTEM}

MODUL: SKLAD SVERKASI. Kamomad (minus) va ortiqcha (plus) summalarni, eng katta farqlarni, mas'ul shaxslar bo'yicha farqlarni va bir necha sverkada takrorlanayotgan tovarlarni tahlil qil. Takrorlanuvchi farq va bir mas'ul shaxsda to'planayotgan kamomad jiddiy xavf belgisi ekanini hisobga ol. Nazorat choralarini tavsiya qil.`,
  MOLIYA: `${BASE_SYSTEM}

MODUL: MOLIYA VA STRATEGIYA. Reja va faktni, marjani, xarajatlar tuzilmasini, strategik maqsadlarga muvofiqlikni (bajarildi / xavf ostida / bajarilmadi) va taktik qarorlar natijasini (qarordan oldingi 2 oy va keyingi 2 oy) tahlil qil. Moliyaviy ko'rsatkichlar kompaniya strategiyasiga mos kelyaptimi — aniq javob ber.`,
  UMUMIY: `${BASE_SYSTEM}

MODUL: UMUMIY BOSHQARUV HISOBOTI. Vazifalar ijrosi, xodimlar faolligi, sklad va moliya bo'yicha qisqa umumiy manzara ber. Eng muhim 3 ta muammo va eng muhim 3 ta yutuqni ajrat. Tavsiyalarda direktor shu hafta nima qilishi kerakligini yoz.`,
};

const QUESTION_SYSTEM = `${BASE_SYSTEM}

Direktor senga erkin savol beradi. Unga faqat berilgan ma'lumotlar asosida javob ber. Savol oddiy bo'lsa ham, javobni uch qismda (Tahlil, Xulosa, Tavsiyalar) ber, lekin qisqa yoz.`;

const DECISION_SYSTEM = `${BASE_SYSTEM}

Senga bitta taktik qaror va unga tegishli ko'rsatkichning qarordan oldingi 2 oy va keyingi 2 oydagi qiymatlari beriladi.
Javobning ENG BIRINCHI qatori aynan quyidagilardan biri bo'lsin:
BAHO: OZINI_OQLADI
BAHO: OQLAMADI
BAHO: HALI_ERTA
(keyingi 2 oy ma'lumoti to'liq bo'lmasa — HALI_ERTA). Keyin bo'sh qator va odatdagi uch qismli javob.`;

function aiDisabledMessage() {
  return "🤖 AI xizmati hozircha ulanmagan. Uni yoqish uchun .env faylga ANTHROPIC_API_KEY kalitini yozing va dasturni qayta ishga tushiring.";
}

function friendlyError(error) {
  if (error instanceof Anthropic.AuthenticationError) return "🤖 AI kaliti noto'g'ri yoki bekor qilingan. .env faylidagi ANTHROPIC_API_KEY ni tekshiring.";
  if (error instanceof Anthropic.PermissionDeniedError) return "🤖 AI kalitiga bu amal uchun ruxsat yo'q. Anthropic Console'dagi sozlamalarni tekshiring.";
  if (error instanceof Anthropic.RateLimitError) return "🤖 AI xizmatiga so'rovlar juda ko'p bo'ldi. Bir necha daqiqadan keyin qayta urinib ko'ring.";
  if (error instanceof Anthropic.BadRequestError) {
    if (/credit|balance|billing/i.test(error.message)) return "🤖 Anthropic hisobingizda mablag' tugagan. console.anthropic.com → Billing bo'limida balansni to'ldiring.";
    return "🤖 AI so'rovni qabul qilmadi. CLAUDE_MODEL nomini tekshiring.";
  }
  if (error instanceof Anthropic.APIConnectionError) return "🤖 AI xizmatiga ulanib bo'lmadi. Internet aloqasini tekshirib, qayta urinib ko'ring.";
  if (error instanceof Anthropic.APIError) return "🤖 AI xizmatida vaqtinchalik nosozlik. Birozdan keyin qayta urinib ko'ring.";
  return "🤖 AI tahlilni tayyorlashda kutilmagan xatolik yuz berdi. Keyinroq qayta urinib ko'ring.";
}

function extractText(response) {
  if (response.stop_reason === 'refusal') {
    return null;
  }
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

async function callClaude(system, userContent) {
  const base = {
    model: config.claudeModel,
    max_tokens: 8000,
    system,
    messages: [{ role: 'user', content: userContent }],
  };
  let response;
  try {
    response = await client.beta.messages.create({
      ...base,
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  } catch (error) {
    if (!(error instanceof Anthropic.BadRequestError) || /credit|balance|billing/i.test(error.message)) throw error;
    response = await client.messages.create(base);
  }
  const text = extractText(response);
  if (!text) throw new Error('AI javob bermadi');
  return text;
}

/* ---------- Kontekst tayyorlash: xom jadval emas, hisoblangan ko'rsatkichlar ---------- */

function pct(v) {
  return v === null || v === undefined ? "ma'lumot yo'q" : `${v}%`;
}

async function tasksContext(days = 30) {
  const now = new Date();
  const from = addDays(now, -days);
  const [summary, delayed, overdue, rows] = await Promise.all([
    analytics.taskSummary({ from, to: now, now }),
    analytics.mostDelayedTasks({ from, to: now, take: 10, now }),
    analytics.currentOverdueTasks({ take: 10, now }),
    analytics.ranking({ days, now }),
  ]);
  const departments = {};
  for (const r of rows) {
    const key = r.department || "Bo'limsiz";
    if (!departments[key]) departments[key] = { vazifalar: 0, bajarildi: 0, muddati_otgan: 0, bajarilmadi: 0 };
    departments[key].vazifalar += r.total;
    departments[key].bajarildi += r.done;
    departments[key].muddati_otgan += r.overdue;
    departments[key].bajarilmadi += r.failed;
  }
  return {
    davr: analytics.periodLabel(from, now),
    jami_vazifalar: summary.total,
    holatlar: Object.fromEntries(Object.entries(summary.byStatus).map(([k, v]) => [STATUS_LABELS[k], v])),
    bajarilish_foizi: pct(summary.completionRate),
    muddatida_bajarish_foizi: pct(summary.onTimeRate),
    hozir_muddati_otgan: summary.overdue,
    bajarilmaslik_sabablari: summary.reasons.map((r) => `${r.label}: ${r.count} ta`),
    bolimlar_kesimida: departments,
    eng_kop_kechikkan_10_vazifa: delayed.map((t) => ({
      vazifa: t.title,
      ijrochi: t.assignee?.fullName,
      bolim: t.assignee?.department,
      deadline: formatDate(t.deadline),
      kechikish_kun: t.delayDays,
      holat: STATUS_LABELS[t.status],
      sabab: t.failReason ? `${REASON_LABELS[t.failReason]}${t.failReasonText ? ` (${t.failReasonText})` : ''}` : "ko'rsatilmagan",
    })),
    hozir_muddati_otgan_vazifalar: overdue.map((t) => ({
      vazifa: t.title,
      ijrochi: t.assignee?.fullName,
      beruvchi: t.assigner?.fullName,
      deadline: formatDateTime(t.deadline),
    })),
  };
}

async function activityContext(days = 30) {
  const now = new Date();
  const [rows, weekly] = await Promise.all([analytics.ranking({ days, now }), analytics.teamWeeklyTrend({ weeks: 6, now })]);
  const comparison = analytics.roleComparison(rows);
  return {
    davr: `oxirgi ${days} kun`,
    reyting: rows.map((r) => ({
      orin: r.rank,
      ism: r.fullName,
      rol: ROLE_LABELS[r.role],
      bolim: r.department,
      ball: r.score ?? "ma'lumot yo'q",
      holat: r.status.label,
      vazifalar: r.total,
      muddatida_bajarish: pct(r.onTimeRate),
      qabul_qilish_ortacha_soat: r.avgAcceptHours,
      ortacha_kechikish_kun: r.avgDelayDays,
      sifat_bahosi: r.avgQuality ?? "baholanmagan",
      qaytarilganlar: r.returns,
      muddati_otgan_hozir: r.overdue,
      haftalik_trend: r.trend.delta === null ? "ma'lumot yo'q" : `${r.trend.delta > 0 ? '+' : ''}${r.trend.delta}`,
    })),
    top_va_middle_solishtirish: comparison.map((c) => ({
      guruh: ROLE_LABELS[c.role],
      xodimlar: c.count,
      ortacha_ball: c.avgScore,
      muddatida_bajarish: pct(c.avgOnTime),
      ortacha_sifat: c.avgQuality,
      qabul_qilish_soat: c.avgAcceptHours,
      muddati_otgan: c.overdue,
      qaytarilganlar: c.returns,
    })),
    haftalik_ortacha_ball: weekly,
  };
}

async function stockContext() {
  const data = await analytics.stockAnalytics();
  const latest = data.checks[0];
  let latestItems = [];
  if (latest) {
    const StockCheck = require('../models/StockCheck');
    const full = await StockCheck.getWithItems(latest.id);
    latestItems = full.items
      .filter((i) => i.diffQty !== 0)
      .sort((a, b) => Math.abs(b.diffSum) - Math.abs(a.diffSum))
      .slice(0, 10)
      .map((i) => ({
        tovar: i.name,
        kod: i.code,
        dasturda: i.systemQty,
        haqiqiy: i.actualQty,
        farq_dona: i.diffQty,
        farq_summa: formatMoney(i.diffSum),
        masul: i.responsible,
      }));
  }
  return {
    sverkalar: data.checks.slice(0, 6).map((c) => ({
      sana: formatDate(c.checkDate),
      sklad: c.warehouse,
      masul: c.responsible,
      tovarlar: c.itemCount,
      kamomad: formatMoney(c.shortageSum),
      ortiqcha: formatMoney(c.surplusSum),
      sof_farq: formatMoney(c.totalDiff),
    })),
    oxirgi_sverka_eng_katta_10_farq: latestItems,
    masul_shaxslar_boyicha: data.byResponsible.map((r) => ({
      masul: r.responsible,
      kamomad: formatMoney(r.shortage),
      ortiqcha: formatMoney(r.surplus),
      farqli_tovarlar: r.items,
      sverkalar_soni: r.checks,
    })),
    takrorlanuvchi_farqlar: data.repeated.slice(0, 10).map((p) => ({
      tovar: p.name,
      necha_sverkada: p.checks,
      jami_farq: formatMoney(p.totalDiffSum),
      masullar: p.responsibles.join(', '),
    })),
  };
}

async function financeContext() {
  const data = await analytics.financeOverview();
  const months = data.months.filter((m) => m.hasFact || m.revenuePlan).slice(-6);
  return {
    oylar: months.map((m) => ({
      oy: monthLabel(m.month),
      tushum_reja: formatMoney(m.revenuePlan),
      tushum_fakt: formatMoney(m.revenue),
      reja_bajarilishi: pct(m.planExecution),
      tannarx: formatMoney(m.cogs),
      xarajatlar_reja: formatMoney(m.expensesPlan),
      xarajatlar_fakt: formatMoney(m.expenses),
      sof_foyda: formatMoney(m.netProfit),
      yalpi_marja: pct(m.grossMargin),
      sof_marja: pct(m.netMargin),
      xarajatlar_ulushi: pct(m.expenseShare),
      tushum_osishi: pct(m.revenueGrowth),
      xarajat_toifalari: Object.fromEntries(
        Object.entries(m.categories).map(([k, v]) => [k, `reja ${formatMoney(v.plan)}, fakt ${formatMoney(v.fact)}`]),
      ),
    })),
    strategik_maqsadlar: data.goals.map((g) => ({
      maqsad: g.name,
      korsatkich: g.metricLabel + (g.category ? ` (${g.category})` : ''),
      shart: `${g.condition === 'GTE' ? '>=' : '<='} ${g.unit === "so'm" ? formatMoney(g.targetValue) : `${g.targetValue}${g.unit}`}`,
      oxirgi_3_oy_ortachasi: g.currentValue === null ? "ma'lumot yo'q" : g.unit === "so'm" ? formatMoney(g.currentValue) : `${g.currentValue}${g.unit}`,
      holat: g.statusLabel,
      davr: g.period,
    })),
    taktik_qarorlar: data.decisions.map((d) => ({
      sana: formatDate(d.date),
      qaror: d.title,
      korsatkich: d.metricLabel,
      kutilgan_natija: d.expectedResult,
      oldingi_2_oy: d.before,
      keyingi_2_oy: d.after,
      ozgarish: d.change,
      avtomatik_baho: VERDICT_LABELS[d.autoVerdict],
    })),
  };
}

async function generalContext() {
  const ov = await analytics.overview();
  const [tasks, activity, stock, finance] = await Promise.all([tasksContext(30), activityContext(30), stockContext(), financeContext()]);
  return {
    umumiy_korsatkichlar: {
      vazifalar_bajarilishi: pct(ov.tasks.completionRate),
      hozir_muddati_otgan: ov.tasks.overdueNow,
      ortacha_faollik_bali: ov.avgScore,
      faol_ortacha_sust: ov.statusCounts,
    },
    vazifalar: {
      bajarilish_foizi: tasks.bajarilish_foizi,
      muddatida: tasks.muddatida_bajarish_foizi,
      sabablar: tasks.bajarilmaslik_sabablari,
      eng_kop_kechikkanlar: tasks.eng_kop_kechikkan_10_vazifa.slice(0, 5),
    },
    faollik: {
      eng_yaxshi_3: activity.reyting.slice(0, 3),
      eng_sust_3: activity.reyting.filter((r) => typeof r.ball === 'number').slice(-3),
      solishtirish: activity.top_va_middle_solishtirish,
    },
    sklad: { sverkalar: stock.sverkalar.slice(0, 2), takrorlanuvchi: stock.takrorlanuvchi_farqlar.slice(0, 5), masullar: stock.masul_shaxslar_boyicha },
    moliya: { oxirgi_oylar: finance.oylar.slice(-3), maqsadlar: finance.strategik_maqsadlar },
  };
}

const CONTEXT_BUILDERS = {
  VAZIFALAR: () => tasksContext(30),
  FAOLLIK: () => activityContext(30),
  SKLAD: stockContext,
  MOLIYA: financeContext,
  UMUMIY: generalContext,
};

function buildUserMessage(title, context) {
  return `${title}\nBugungi sana: ${formatDate(new Date())}.\n\nMA'LUMOTLAR (JSON):\n${JSON.stringify(context, null, 1)}`;
}

/** Modul bo'yicha hisobot tuzadi va saqlaydi. Xato bo'lsa { ok:false, message } qaytaradi — tizim to'xtamaydi. */
async function generateReport(module, { periodLabel } = {}) {
  if (!MODULE_PROMPTS[module]) return { ok: false, message: "Noma'lum modul" };
  if (!client) return { ok: false, message: aiDisabledMessage() };
  try {
    const context = await CONTEXT_BUILDERS[module]();
    const period = periodLabel || (module === 'SKLAD' || module === 'MOLIYA' ? 'Oxirgi holat' : 'Oxirgi 30 kun');
    const text = await callClaude(MODULE_PROMPTS[module], buildUserMessage(`"${MODULE_LABELS[module]}" bo'yicha hisobot tayyorla. Davr: ${period}.`, context));
    const report = await AiReport.save({ module, period, text });
    return { ok: true, report };
  } catch (error) {
    console.error(`[AI] ${module} hisobotida xato:`, error.message);
    return { ok: false, message: friendlyError(error) };
  }
}

async function askQuestion(question) {
  if (!client) return { ok: false, message: aiDisabledMessage() };
  try {
    const context = await generalContext();
    const full = { ...context, vazifalar_batafsil: await tasksContext(30), faollik_batafsil: await activityContext(30), moliya_batafsil: await financeContext() };
    const text = await callClaude(QUESTION_SYSTEM, buildUserMessage(`Direktor savoli: "${String(question).slice(0, 1000)}"`, full));
    const report = await AiReport.save({ module: 'UMUMIY', period: 'Erkin savol', text, question: String(question).slice(0, 1000) });
    return { ok: true, report };
  } catch (error) {
    console.error('[AI] Savolga javobda xato:', error.message);
    return { ok: false, message: friendlyError(error) };
  }
}

function localDecisionComment(evaluated) {
  if (evaluated.autoVerdict === 'HALI_ERTA') {
    return "Qarordan keyingi 2 oylik to'liq fakt ma'lumoti hali yo'q, shuning uchun baho berish erta.";
  }
  const dir = evaluated.change > 0 ? "o'sdi" : evaluated.change < 0 ? 'kamaydi' : "o'zgarmadi";
  return `${evaluated.metricLabel} qarordan oldingi 2 oyda o'rtacha ${evaluated.before}${evaluated.unit}, keyingi 2 oyda ${evaluated.after}${evaluated.unit} bo'ldi (${dir}). Avtomatik hisob-kitob bo'yicha: ${VERDICT_LABELS[evaluated.autoVerdict]}.`;
}

/** Taktik qarorni baholaydi. AI ulanmagan bo'lsa — avtomatik hisob-kitob asosida baho beradi. */
async function evaluateDecision(evaluated) {
  if (!client) {
    return { ok: true, verdict: evaluated.autoVerdict, comment: localDecisionComment(evaluated), source: 'auto' };
  }
  try {
    const context = {
      qaror: evaluated.title,
      tavsif: evaluated.description,
      sana: formatDate(evaluated.date),
      korsatkich: evaluated.metricLabel + (evaluated.category ? ` (${evaluated.category})` : ''),
      qaysi_yonalish_yaxshi: evaluated.better === 'up' ? "o'sish yaxshi" : 'kamayish yaxshi',
      kutilgan_natija: evaluated.expectedResult,
      oldingi_2_oy: evaluated.beforeMonths.map(monthLabel).join(', '),
      oldingi_ortacha: evaluated.before,
      keyingi_2_oy: evaluated.afterMonths.map(monthLabel).join(', '),
      keyingi_ortacha: evaluated.after,
      ozgarish: evaluated.change,
      birlik: evaluated.unit,
    };
    const text = await callClaude(DECISION_SYSTEM, buildUserMessage('Taktik qarorni baholab ber.', context));
    const match = text.match(/BAHO:\s*(OZINI_OQLADI|OQLAMADI|HALI_ERTA)/);
    const verdict = match ? match[1] : evaluated.autoVerdict;
    const comment = text.replace(/^.*BAHO:.*\n?/, '').trim();
    await AiReport.save({ module: 'MOLIYA', period: `Taktik qaror: ${evaluated.title}`, text: comment });
    return { ok: true, verdict, comment, source: 'ai' };
  } catch (error) {
    console.error('[AI] Qarorni baholashda xato:', error.message);
    return { ok: true, verdict: evaluated.autoVerdict, comment: `${localDecisionComment(evaluated)}\n\n${friendlyError(error)}`, source: 'auto' };
  }
}

module.exports = { generateReport, askQuestion, evaluateDecision, isEnabled: () => Boolean(client), aiDisabledMessage };
