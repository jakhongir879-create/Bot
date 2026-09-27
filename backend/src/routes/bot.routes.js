const c = require('../controllers/botController');

function registerBotRoutes(bot) {
  // Ruxsatsiz ham ishlaydi
  bot.command('id', c.myId);

  // Qolganlari faqat adminlar uchun
  bot.use(c.accessGuard);

  bot.start(c.start);
  bot.help(c.help);
  bot.command('bekor', c.cancel);
  bot.command('cancel', c.cancel);
  bot.command('addadmin', c.addAdmin);

  bot.hears(c.BTN.today, (ctx) => c.report(ctx, 'today'));
  bot.hears(c.BTN.week, (ctx) => c.report(ctx, 'week'));
  bot.hears(c.BTN.month, (ctx) => c.report(ctx, 'month'));
  bot.hears(c.BTN.chart, c.chart);
  bot.hears(c.BTN.top, c.top);
  bot.hears(c.BTN.sale, c.saleStart);
  bot.hears(c.BTN.expense, c.expenseStart);
  bot.hears(c.BTN.stock, c.stock);
  bot.hears(c.BTN.debts, c.debts);
  bot.hears(c.BTN.excel, c.excel);
  bot.hears(c.BTN.dashboard, c.dashboard);
  bot.hears(c.BTN.help, c.help);

  bot.action(/^r:(\w+)$/, c.reportCallback);
  bot.action(/^t:(\w+)$/, c.topCallback);
  bot.action(/^x:(\w+)$/, c.excelCallback);
  bot.action(/^c:(\d+)$/, c.chartCallback);

  bot.action(/^spg:(\d+)$/, c.salePage);
  bot.action(/^sp:(\d+)$/, c.saleProduct);
  bot.action('s:add', c.saleAdd);
  bot.action('s:done', c.saleDone);
  bot.action('s:cancel', c.saleCancel);
  bot.action(/^s:pay:(\w+)$/, c.salePay);

  bot.action(/^e:cat:(\d+)$/, c.expenseCategory);
  bot.action('e:skip', c.expenseSkipNote);
  bot.action('e:cancel', c.expenseCancel);

  bot.on('text', c.onText);

  bot.catch((err, ctx) => {
    console.error('Bot xatosi:', err);
    ctx.reply("⚠️ Xatolik yuz berdi. Qaytadan urinib ko'ring.").catch(() => {});
  });
}

module.exports = registerBotRoutes;
