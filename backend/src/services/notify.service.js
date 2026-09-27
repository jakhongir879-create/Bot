const bot = require('../core/bot');
const Admin = require('../models/Admin');
const config = require('../config/default');
const { money, escapeHtml: e, qty } = require('../utils/format');

async function sendToAdmins(text, extra = {}, excludeTelegramId) {
  const admins = await Admin.activeRecipients();
  const ids = new Set([...admins.map((a) => a.telegramId), ...config.ownerIds]);
  if (excludeTelegramId) ids.delete(String(excludeTelegramId));
  for (const id of ids) {
    try {
      await bot.telegram.sendMessage(id, text, { parse_mode: 'HTML', ...extra });
    } catch (err) {
      console.warn(`⚠️ ${id} ga xabar yuborilmadi: ${err.message}`);
    }
  }
}

function saleText(sale) {
  const lines = [
    `🧾 <b>Sotuv №${sale.id}</b>`,
    ...sale.items.map((i) => ` • ${e(i.productName)} × ${qty(i.quantity)} = ${money(i.total)}`),
  ];
  if (sale.discount) lines.push(`🏷 Chegirma: ${money(sale.discount)}`);
  lines.push(`💰 Jami: <b>${money(sale.total)}</b>`);
  lines.push(`💳 To'lov: ${config.paymentMethods[sale.paymentMethod]}`);
  if (sale.customer) lines.push(`👤 Mijoz: ${e(sale.customer.name)}`);
  if (sale.paidAmount < sale.total) lines.push(`⏳ Qarz: <b>${money(sale.total - sale.paidAmount)}</b>`);
  if (sale.createdBy) lines.push(`🙋 Kassir: ${e(sale.createdBy.name)}`);
  return lines.join('\n');
}

async function notifySale(sale, excludeTelegramId) {
  if (!config.notifyNewSales) return;
  await sendToAdmins(`🔔 Yangi sotuv!\n\n${saleText(sale)}`, {}, excludeTelegramId);
}

module.exports = { sendToAdmins, saleText, notifySale };
