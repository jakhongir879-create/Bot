const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const config = require('./config/default');
const prisma = require('./database/connection');
const bot = require('./core/bot');
const registerBotRoutes = require('./routes/bot.routes');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const { errorHandler } = require('./middlewares/error.middleware');
const { startScheduler } = require('./services/scheduler');

async function main() {
  await prisma.$connect();
  console.log("✅ Maʼlumotlar bazasiga ulandi");

  // ===== API =====
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api', adminRoutes);
  app.use('/api', (req, res) => res.status(404).json({ message: 'Topilmadi' }));

  // Dashboard build qilingan bo'lsa, shu serverning o'zida ochiladi
  const dist = path.join(__dirname, '..', '..', 'dashboard', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    app.get('/', (req, res) =>
      res.send('Dashboard hali build qilinmagan. dashboard papkasida "npm run build" ni ishga tushiring.')
    );
  }

  app.use(errorHandler);
  app.listen(config.port, () => {
    console.log(`🌐 Dashboard va API: http://localhost:${config.port}`);
  });

  // ===== BOT =====
  registerBotRoutes(bot);
  try {
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Bosh menyu' },
      { command: 'help', description: 'Yordam' },
      { command: 'id', description: 'Telegram ID ni bilish' },
      { command: 'bekor', description: 'Joriy amalni bekor qilish' },
    ]);
    if (config.webAppUrl.startsWith('https://')) {
      await bot.telegram.setChatMenuButton({
        menuButton: { type: 'web_app', text: 'Dashboard', web_app: { url: config.webAppUrl } },
      });
      console.log(`📱 Mini App tugmasi ulandi: ${config.webAppUrl}`);
    } else {
      await bot.telegram.setChatMenuButton({ menuButton: { type: 'commands' } });
    }
    bot
      .launch({ dropPendingUpdates: true }, () => console.log(`🤖 Bot ishga tushdi: @${bot.botInfo?.username}`))
      .catch((err) => console.error(`❌ Bot to'xtadi: ${err.message}`));
  } catch (err) {
    console.error(`❌ Bot ishga tushmadi (BOT_TOKEN ni tekshiring): ${err.message}`);
  }

  startScheduler();

  const stop = async (signal) => {
    try {
      bot.stop(signal);
    } catch {
      // bot ishga tushmagan bo'lishi mumkin
    }
    await prisma.$disconnect();
    process.exit(0);
  };
  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));
}

main().catch((err) => {
  console.error('❌ Ishga tushirishda xato:', err);
  process.exit(1);
});
