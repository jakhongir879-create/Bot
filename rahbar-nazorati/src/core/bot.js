const { Bot } = require('grammy');
const { config } = require('../config/default');

const bot = new Bot(config.botToken || 'missing-token');

bot.catch((err) => {
  console.error(`[BOT] Xatolik (update ${err.ctx?.update?.update_id}):`, err.error?.message || err.error);
});

module.exports = { bot };
