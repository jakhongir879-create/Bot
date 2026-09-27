const { Telegraf } = require('telegraf');
const config = require('../config/default');

if (!config.botToken) {
  console.error("❌ BOT_TOKEN topilmadi. backend/.env faylini to'ldiring.");
  process.exit(1);
}

const bot = new Telegraf(config.botToken);

module.exports = bot;
