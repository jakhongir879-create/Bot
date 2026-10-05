const { bot } = require('../core/bot');
const botController = require('../controllers/botController');

function registerBotRoutes() {
  bot.command('start', botController.handleStart);
  bot.command('menu', botController.handleStart);
  bot.command('brifing', botController.handleBriefCommand);
  bot.command('yangi', botController.handleResetCommand);
  bot.on('message:contact', botController.handleContact);
  bot.on(['message:document', 'message:photo', 'message:video'], botController.handleIncomingFile);
  bot.on('message:text', botController.handleText);
  bot.on('callback_query:data', botController.handleCallback);
}

module.exports = { registerBotRoutes };
