const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { config, validateConfig } = require('./config/default');
const { prisma, connectDatabase, disconnectDatabase } = require('./database/connection');
const { bot } = require('./core/bot');
const { registerBotRoutes } = require('./routes/bot.routes');
const appRoutes = require('./routes/app.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const { startScheduler } = require('./jobs/scheduler');

function serveSpa(app, urlPath, distDir, name) {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    app.get(urlPath, (req, res) => res.status(503).send(`${name} hali build qilinmagan. Terminalda "npm run build" buyrug'ini bajaring.`));
    return;
  }
  app.use(urlPath, express.static(distDir, { index: false, maxAge: '1h' }));
  app.get(`${urlPath}/{*splat}`, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
  app.get(urlPath, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

/** Dashboard faqat shu kompyuterdan ochiladi (ngrok orqali tashqaridan kirib bo'lmaydi) */
function localOnly(req, res, next) {
  if (config.dashboardPublic || LOCAL_HOSTS.includes(req.hostname)) return next();
  return res.status(403).send("Web Dashboard faqat server ishlayotgan kompyuterda ochiladi: http://localhost:" + config.port + '/dashboard');
}

function createServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/app', appRoutes);
  app.use(['/api/dashboard', '/dashboard'], localOnly);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Topilmadi' }));

  serveSpa(app, '/app', config.paths.miniappDist, 'Mini App');
  serveSpa(app, '/dashboard', config.paths.dashboardDist, 'Dashboard');
  app.get('/', (req, res) => res.redirect('/dashboard'));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Fayl hajmi juda katta' : 'Faylni yuklashda xatolik';
      return res.status(400).json({ error: message });
    }
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error('[API] Xatolik:', err);
    if (err.code === 'P2025') return res.status(404).json({ error: 'Yozuv topilmadi' });
    if (err.code === 'P2002') return res.status(400).json({ error: 'Bunday yozuv allaqachon mavjud' });
    return res.status(status).json({ error: status >= 500 ? "Serverda xatolik yuz berdi. Keyinroq qayta urinib ko'ring." : err.message });
  });
  return app;
}

/** Bo'sh bazada ham direktor tizimga kira olishi uchun boshlang'ich yozuvlar */
async function ensureBaseRecords() {
  if (!(await prisma.company.findFirst())) await prisma.company.create({ data: { name: 'Kompaniya' } });
  const director = await prisma.employee.findFirst({ where: { role: 'DIRECTOR' } });
  if (!director) {
    const taken = await prisma.employee.findFirst({ where: { telegramId: config.directorTelegramId } });
    if (!taken) {
      await prisma.employee.create({
        data: { fullName: 'Direktor', phone: `+000${config.directorTelegramId}`, position: 'Direktor', role: 'DIRECTOR', telegramId: config.directorTelegramId, isStockResponsible: true },
      });
      console.log("👤 Direktor yozuvi yaratildi (ismi va telefonini Dashboard → Xodimlar bo'limida o'zgartiring)");
    }
  }
}

async function setupBotMenu() {
  await bot.api.setMyCommands([{ command: 'start', description: 'Bosh menyu' }]);
  if (config.webappUrl.startsWith('https://')) {
    await bot.api.setChatMenuButton({ menu_button: { type: 'web_app', text: 'Ilova', web_app: { url: `${config.webappUrl}/app/` } } });
    console.log(`📱 Mini App tugmasi ulandi: ${config.webappUrl}/app/`);
  } else {
    console.log('⚠️  WEBAPP_URL (https) yozilmagan — Mini App tugmasi ulanmadi. Bot va Dashboard ishlayveradi.');
  }
}

async function main() {
  const missing = validateConfig();
  if (missing.length) {
    console.error(`\n❌ .env faylida quyidagilar to'ldirilmagan: ${missing.join(', ')}\n`);
    process.exit(1);
  }

  await connectDatabase();
  console.log("✅ Ma'lumotlar bazasiga ulandi");
  await ensureBaseRecords();

  const app = createServer();
  const server = app.listen(config.port, () => {
    console.log(`🌐 Web Dashboard: http://localhost:${config.port}/dashboard`);
    console.log(`📱 Mini App (lokal): http://localhost:${config.port}/app`);
  });

  registerBotRoutes();
  try {
    await bot.init();
    await setupBotMenu();
    bot.start({ drop_pending_updates: true, allowed_updates: ['message', 'callback_query'] }).catch((error) => {
      console.error('❌ Bot to\'xtadi:', error.message);
    });
    console.log(`🤖 Bot ishga tushdi: @${bot.botInfo.username}`);
  } catch (error) {
    console.error(`❌ Botni ishga tushirib bo'lmadi (BOT_TOKEN ni tekshiring): ${error.message}`);
  }

  startScheduler();
  console.log(config.aiEnabled ? `🧠 AI yoqilgan (model: ${config.claudeModel})` : '🧠 AI o\'chirilgan (ANTHROPIC_API_KEY yozilmagan)');

  const shutdown = async () => {
    console.log("\nTo'xtatilmoqda...");
    await bot.stop().catch(() => {});
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('❌ Ishga tushirishda xatolik:', error);
  process.exit(1);
});
