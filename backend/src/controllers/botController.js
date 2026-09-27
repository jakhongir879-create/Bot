const { Markup } = require('telegraf');
const config = require('../config/default');
const Admin = require('../models/Admin');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const texts = require('../services/botText.service');
const { buildWorkbook } = require('../services/excel.service');
const { saleText, notifySale } = require('../services/notify.service');
const { money, qty, escapeHtml: e } = require('../utils/format');

// ====== Tugmalar ======
const BTN = {
  today: '📊 Bugun',
  week: '📅 Hafta',
  month: '🗓 Oy',
  chart: '📈 Grafik',
  top: '🏆 Top mahsulotlar',
  sale: '➕ Sotuv',
  expense: '➖ Xarajat',
  stock: '📦 Ombor',
  debts: '💳 Qarzdorlar',
  excel: '📥 Excel hisobot',
  dashboard: '🌐 Dashboard',
  help: 'ℹ️ Yordam',
};

const mainKeyboard = Markup.keyboard([
  [BTN.today, BTN.week, BTN.month],
  [BTN.chart, BTN.top],
  [BTN.sale, BTN.expense],
  [BTN.stock, BTN.debts],
  [BTN.excel, BTN.dashboard],
  [BTN.help],
]).resize();

const periodButtons = (prefix) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('Bugun', `${prefix}:today`),
      Markup.button.callback('Kecha', `${prefix}:yesterday`),
      Markup.button.callback('7 kun', `${prefix}:week`),
    ],
    [
      Markup.button.callback('Joriy oy', `${prefix}:month`),
      Markup.button.callback("O'tgan oy", `${prefix}:lastMonth`),
      Markup.button.callback('Yil', `${prefix}:year`),
    ],
  ]);

const HTML = { parse_mode: 'HTML' };

// ====== Suhbat holati (sotuv/xarajat kiritish jarayoni) ======
const sessions = new Map();
const getSession = (ctx) => sessions.get(ctx.from.id);
const setSession = (ctx, data) => sessions.set(ctx.from.id, data);
const clearSession = (ctx) => sessions.delete(ctx.from.id);

// ====== Ruxsat tekshiruvi ======
async function accessGuard(ctx, next) {
  if (!ctx.from) return;
  const admin = await Admin.resolve(ctx.from);
  if (!admin) {
    const text =
      `⛔️ Sizda bu botdan foydalanish uchun ruxsat yo'q.\n\n` +
      `🆔 Sizning Telegram ID: <code>${ctx.from.id}</code>\n\n` +
      `Ushbu ID ni biznes egasiga yuboring — u sizni Dashboard → Sozlamalar bo'limidan qo'shadi.`;
    if (ctx.callbackQuery) return ctx.answerCbQuery("Ruxsat yo'q", { show_alert: true });
    return ctx.reply(text, HTML);
  }
  ctx.state.admin = admin;
  return next();
}

// ====== Asosiy buyruqlar ======
async function start(ctx) {
  clearSession(ctx);
  const a = ctx.state.admin;
  await ctx.reply(
    `Assalomu alaykum, <b>${e(a.name)}</b>! 👋\n\n` +
      `Bu <b>${e(config.businessName)}</b> biznes hisobotlari boti.\n` +
      `Pastdagi tugmalar orqali savdo, foyda, xarajat va ombor hisobotlarini ko'ring.\n\n` +
      `👤 Rolingiz: <b>${a.role === 'OWNER' ? 'Egasi' : 'Menejer'}</b>`,
    { ...HTML, ...mainKeyboard }
  );
}

async function help(ctx) {
  await ctx.reply(
    [
      'ℹ️ <b>Yordam</b>',
      '',
      `${BTN.today} / ${BTN.week} / ${BTN.month} — tushum, foyda, xarajat hisoboti`,
      `${BTN.chart} — so'nggi 7 kunlik grafik`,
      `${BTN.top} — eng ko'p sotilgan mahsulotlar`,
      `${BTN.sale} — yangi sotuv kiritish`,
      `${BTN.expense} — xarajat kiritish`,
      `${BTN.stock} — ombordagi qoldiqlar`,
      `${BTN.debts} — nasiya olgan mijozlar`,
      `${BTN.excel} — Excel fayl ko'rinishida hisobot`,
      `${BTN.dashboard} — to'liq web-dashboard`,
      '',
      `🕘 Har kuni soat <b>${config.dailyReportTime}</b> da kunlik hisobot avtomatik keladi.`,
      '',
      '<b>Buyruqlar:</b>',
      '/start — bosh menyu',
      '/id — Telegram ID ingizni bilish',
      '/bekor — joriy amalni bekor qilish',
      "/addadmin ID Ism — xodim qo'shish (faqat egasi)",
    ].join('\n'),
    HTML
  );
}

async function myId(ctx) {
  await ctx.reply(`🆔 Sizning Telegram ID: <code>${ctx.from.id}</code>`, HTML);
}

async function cancel(ctx) {
  clearSession(ctx);
  await ctx.reply('❌ Bekor qilindi.', mainKeyboard);
}

async function addAdmin(ctx) {
  if (ctx.state.admin.role !== 'OWNER') return ctx.reply("⛔️ Bu buyruq faqat biznes egasi uchun.");
  const [, id, ...nameParts] = ctx.message.text.trim().split(/\s+/);
  if (!id || !/^\d+$/.test(id)) {
    return ctx.reply("Foydalanish: /addadmin 123456789 Ism\n\nXodim o'z ID sini /id buyrug'i orqali bilib oladi.");
  }
  const admin = await Admin.create({ telegramId: id, name: nameParts.join(' ') || 'Xodim', role: 'MANAGER' });
  await ctx.reply(`✅ <b>${e(admin.name)}</b> (ID: ${admin.telegramId}) menejer sifatida qo'shildi.`, HTML);
}

// ====== Hisobotlar ======
async function report(ctx, period) {
  clearSession(ctx);
  await ctx.reply(await texts.summaryText(period), { ...HTML, ...periodButtons('r') });
}

async function reportCallback(ctx) {
  const period = ctx.match[1];
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(await texts.summaryText(period), { ...HTML, ...periodButtons('r') });
  } catch (err) {
    if (!String(err.message).includes('message is not modified')) throw err;
  }
}

async function chart(ctx) {
  await ctx.reply(
    await texts.chartText(7),
    { ...HTML, ...Markup.inlineKeyboard([[Markup.button.callback("30 kunlik ko'rish", 'c:30')]]) }
  );
}

async function chartCallback(ctx) {
  await ctx.answerCbQuery();
  await ctx.reply(await texts.chartText(Number(ctx.match[1])), HTML);
}

async function top(ctx) {
  await ctx.reply(await texts.topText('month'), { ...HTML, ...periodButtons('t') });
}

async function topCallback(ctx) {
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(await texts.topText(ctx.match[1]), { ...HTML, ...periodButtons('t') });
  } catch (err) {
    if (!String(err.message).includes('message is not modified')) throw err;
  }
}

async function stock(ctx) {
  await ctx.reply(await texts.stockText(), HTML);
}

async function debts(ctx) {
  await ctx.reply(await texts.debtText(), HTML);
}

async function excel(ctx) {
  await ctx.reply('📥 Qaysi davr uchun Excel hisobot kerak?', periodButtons('x'));
}

async function excelCallback(ctx) {
  await ctx.answerCbQuery('Tayyorlanmoqda...');
  const { buffer, filename, range } = await buildWorkbook(ctx.match[1]);
  await ctx.replyWithDocument({ source: buffer, filename }, { caption: `📊 ${range.label} hisoboti` });
}

async function dashboard(ctx) {
  if (config.webAppUrl.startsWith('https://')) {
    return ctx.reply(
      "🌐 To'liq dashboardni Telegram ichida oching:",
      Markup.inlineKeyboard([[Markup.button.webApp('📊 Dashboardni ochish', config.webAppUrl)]])
    );
  }
  return ctx.reply(
    `🌐 Dashboard kompyuteringizda ochiladi:\nhttp://localhost:${config.port}\n\n` +
      `Telegram ichida ochish uchun ngrok manzilini .env dagi WEBAPP_URL ga yozing (README ga qarang).`
  );
}

// ====== Sotuv kiritish ======
const PAGE = 16;

function productKeyboard(products, page = 0) {
  const slice = products.slice(page * PAGE, page * PAGE + PAGE);
  const rows = [];
  for (let i = 0; i < slice.length; i += 2) {
    rows.push(
      slice.slice(i, i + 2).map((p) => Markup.button.callback(`${p.name} • ${money(p.salePrice)}`, `sp:${p.id}`))
    );
  }
  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('⬅️', `spg:${page - 1}`));
  if ((page + 1) * PAGE < products.length) nav.push(Markup.button.callback('➡️', `spg:${page + 1}`));
  if (nav.length) rows.push(nav);
  rows.push([Markup.button.callback('❌ Bekor qilish', 's:cancel')]);
  return Markup.inlineKeyboard(rows);
}

function cartText(cart) {
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  return [
    '🛒 <b>Savat:</b>',
    ...cart.map((i, n) => `${n + 1}. ${e(i.name)} × ${qty(i.quantity)} = ${money(i.price * i.quantity)}`),
    '',
    `💰 Jami: <b>${money(total)}</b>`,
  ].join('\n');
}

const cartKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("➕ Yana mahsulot qo'shish", 's:add')],
  [Markup.button.callback('✅ Rasmiylashtirish', 's:done')],
  [Markup.button.callback('❌ Bekor qilish', 's:cancel')],
]);

const payKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('💵 Naqd', 's:pay:CASH'), Markup.button.callback('💳 Karta', 's:pay:CARD')],
  [Markup.button.callback("🏦 O'tkazma", 's:pay:TRANSFER'), Markup.button.callback('📒 Nasiya', 's:pay:DEBT')],
  [Markup.button.callback('❌ Bekor qilish', 's:cancel')],
]);

async function saleStart(ctx) {
  const products = await Product.list({ activeOnly: true });
  if (!products.length) return ctx.reply("Mahsulotlar yo'q. Avval Dashboard orqali mahsulot qo'shing.");
  const s = getSession(ctx);
  const cart = s?.flow === 'sale' ? s.cart : [];
  setSession(ctx, { flow: 'sale', step: 'product', cart });
  await ctx.reply('🛍 Mahsulotni tanlang:', productKeyboard(products));
}

async function salePage(ctx) {
  await ctx.answerCbQuery();
  const products = await Product.list({ activeOnly: true });
  await ctx.editMessageReplyMarkup(productKeyboard(products, Number(ctx.match[1])).reply_markup);
}

async function saleProduct(ctx) {
  await ctx.answerCbQuery();
  const s = getSession(ctx);
  if (s?.flow !== 'sale') return ctx.reply(`Jarayon eskirgan. Qaytadan "${BTN.sale}" ni bosing.`);
  const p = await Product.find(ctx.match[1]);
  if (!p) return ctx.reply('Mahsulot topilmadi.');
  setSession(ctx, { ...s, step: 'qty', pending: { productId: p.id, name: p.name, price: p.salePrice, unit: p.unit } });
  await ctx.reply(
    `<b>${e(p.name)}</b>\nNarxi: ${money(p.salePrice)}\nOmborda: ${qty(p.stock)} ${e(p.unit)}\n\n✍️ Miqdorini yozing (masalan: 2 yoki 1.5):`,
    HTML
  );
}

async function saleAdd(ctx) {
  await ctx.answerCbQuery();
  return saleStart(ctx);
}

async function saleDone(ctx) {
  await ctx.answerCbQuery();
  const s = getSession(ctx);
  if (s?.flow !== 'sale' || !s.cart.length) return ctx.reply("Savat bo'sh.");
  setSession(ctx, { ...s, step: 'payment' });
  await ctx.reply(`${cartText(s.cart)}\n\n💳 To'lov turini tanlang:`, { ...HTML, ...payKeyboard });
}

async function salePay(ctx) {
  await ctx.answerCbQuery();
  const s = getSession(ctx);
  if (s?.flow !== 'sale' || !s.cart.length) return ctx.reply("Savat bo'sh.");
  const method = ctx.match[1];
  if (method === 'DEBT') {
    setSession(ctx, { ...s, step: 'customer', paymentMethod: method });
    return ctx.reply("👤 Mijoz ismi va telefonini yozing.\nMasalan: <code>Ali Valiyev, +998901234567</code>", HTML);
  }
  return finishSale(ctx, { ...s, paymentMethod: method });
}

async function saleCancel(ctx) {
  await ctx.answerCbQuery('Bekor qilindi');
  clearSession(ctx);
  await ctx.reply('❌ Sotuv bekor qilindi.', mainKeyboard);
}

async function finishSale(ctx, s) {
  try {
    const sale = await Sale.create({
      items: s.cart.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
      paymentMethod: s.paymentMethod,
      paidAmount: s.paidAmount,
      customerId: s.customerId,
      createdById: ctx.state.admin.id,
    });
    clearSession(ctx);
    await ctx.reply(`✅ Sotuv saqlandi!\n\n${saleText(sale)}`, { ...HTML, ...mainKeyboard });
    notifySale(sale, ctx.from.id).catch(() => {});
  } catch (err) {
    await ctx.reply(`⚠️ ${err.message}`);
  }
}

// ====== Xarajat kiritish ======
async function expenseStart(ctx) {
  setSession(ctx, { flow: 'expense', step: 'category' });
  const cats = config.expenseCategories;
  const rows = [];
  for (let i = 0; i < cats.length; i += 2) {
    rows.push(cats.slice(i, i + 2).map((c, j) => Markup.button.callback(c, `e:cat:${i + j}`)));
  }
  rows.push([Markup.button.callback('❌ Bekor qilish', 'e:cancel')]);
  await ctx.reply('💸 Xarajat turini tanlang:', Markup.inlineKeyboard(rows));
}

async function expenseCategory(ctx) {
  await ctx.answerCbQuery();
  const category = config.expenseCategories[Number(ctx.match[1])];
  setSession(ctx, { flow: 'expense', step: 'amount', category });
  await ctx.reply(`<b>${e(category)}</b>\n\n✍️ Summani yozing (masalan: 150000):`, HTML);
}

async function expenseSkipNote(ctx) {
  await ctx.answerCbQuery();
  const s = getSession(ctx);
  if (s?.flow !== 'expense' || !s.amount) return;
  return finishExpense(ctx, s, null);
}

async function expenseCancel(ctx) {
  await ctx.answerCbQuery('Bekor qilindi');
  clearSession(ctx);
  await ctx.reply('❌ Bekor qilindi.', mainKeyboard);
}

async function finishExpense(ctx, s, note) {
  try {
    const exp = await Expense.create({ category: s.category, amount: s.amount, note }, ctx.state.admin.id);
    clearSession(ctx);
    await ctx.reply(
      `✅ Xarajat saqlandi!\n\n📂 ${e(exp.category)}\n💸 ${money(exp.amount)}${exp.note ? `\n📝 ${e(exp.note)}` : ''}`,
      { ...HTML, ...mainKeyboard }
    );
  } catch (err) {
    await ctx.reply(`⚠️ ${err.message}`);
  }
}

// ====== Matnli javoblar (miqdor, summa, mijoz...) ======
const parseNumber = (t) => Number(String(t).replace(/\s/g, '').replace(',', '.'));

async function onText(ctx) {
  const s = getSession(ctx);
  const text = ctx.message.text.trim();
  if (!s) return ctx.reply('Menyudan kerakli bo\'limni tanlang 👇', mainKeyboard);

  if (s.flow === 'sale' && s.step === 'qty') {
    const q = parseNumber(text);
    if (!(q > 0)) return ctx.reply("❗️ Miqdor noto'g'ri. Raqam yozing, masalan: 2");
    const cart = [...s.cart];
    const found = cart.find((i) => i.productId === s.pending.productId);
    if (found) found.quantity += q;
    else cart.push({ ...s.pending, quantity: q });
    setSession(ctx, { flow: 'sale', step: 'cart', cart });
    return ctx.reply(cartText(cart), { ...HTML, ...cartKeyboard });
  }

  if (s.flow === 'sale' && s.step === 'customer') {
    const [name, phone] = text.split(',').map((x) => x.trim());
    if (!name) return ctx.reply('❗️ Mijoz ismini yozing.');
    const customer = await Customer.findOrCreate({ name, phone });
    setSession(ctx, { ...s, step: 'paid', customerId: customer.id });
    return ctx.reply("💵 Hozir qancha to'landi? (hech narsa to'lanmagan bo'lsa 0 yozing)");
  }

  if (s.flow === 'sale' && s.step === 'paid') {
    const paid = parseNumber(text);
    if (!(paid >= 0)) return ctx.reply("❗️ Summa noto'g'ri. Masalan: 0 yoki 50000");
    return finishSale(ctx, { ...s, paidAmount: paid });
  }

  if (s.flow === 'expense' && s.step === 'amount') {
    const amount = parseNumber(text);
    if (!(amount > 0)) return ctx.reply("❗️ Summa noto'g'ri. Masalan: 150000");
    setSession(ctx, { ...s, step: 'note', amount });
    return ctx.reply(
      '📝 Izoh yozing (ixtiyoriy):',
      Markup.inlineKeyboard([[Markup.button.callback("⏭ O'tkazib yuborish", 'e:skip')]])
    );
  }

  if (s.flow === 'expense' && s.step === 'note') {
    return finishExpense(ctx, s, text);
  }

  return ctx.reply('Tugmalardan birini tanlang 👆');
}

module.exports = {
  BTN,
  accessGuard,
  start,
  help,
  myId,
  cancel,
  addAdmin,
  report,
  reportCallback,
  chart,
  chartCallback,
  top,
  topCallback,
  stock,
  debts,
  excel,
  excelCallback,
  dashboard,
  saleStart,
  salePage,
  saleProduct,
  saleAdd,
  saleDone,
  salePay,
  saleCancel,
  expenseStart,
  expenseCategory,
  expenseSkipNote,
  expenseCancel,
  onText,
};
