const cron = require('node-cron');
const config = require('../config/default');
const texts = require('./botText.service');
const { sendToAdmins } = require('./notify.service');

function startScheduler() {
  const [h, m] = config.dailyReportTime.split(':').map(Number);
  const hour = Number.isFinite(h) ? h : 21;
  const minute = Number.isFinite(m) ? m : 0;

  // Har kuni kunlik hisobot
  cron.schedule(
    `${minute} ${hour} * * *`,
    async () => {
      try {
        await sendToAdmins(await texts.dailyReportText());
      } catch (err) {
        console.error('Kunlik hisobot xatosi:', err);
      }
    },
    { timezone: config.timezone }
  );

  // Har dushanba 09:00 da haftalik hisobot
  cron.schedule(
    '0 9 * * 1',
    async () => {
      try {
        await sendToAdmins(`📅 <b>Haftalik hisobot</b>\n\n${await texts.summaryText('week')}`);
      } catch (err) {
        console.error('Haftalik hisobot xatosi:', err);
      }
    },
    { timezone: config.timezone }
  );

  // Har oyning 1-kuni 09:05 da o'tgan oy hisoboti
  cron.schedule(
    '5 9 1 * *',
    async () => {
      try {
        await sendToAdmins(`🗓 <b>Oylik hisobot</b>\n\n${await texts.summaryText('lastMonth')}`);
      } catch (err) {
        console.error('Oylik hisobot xatosi:', err);
      }
    },
    { timezone: config.timezone }
  );

  console.log(`⏰ Kunlik hisobot har kuni ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} da yuboriladi`);
}

module.exports = { startScheduler };
