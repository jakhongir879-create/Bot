const crypto = require('crypto');
const { config } = require('../config/default');
const Employee = require('../models/Employee');

const MAX_AGE_SECONDS = 24 * 60 * 60;

/** Telegram Mini App initData imzosini BOT_TOKEN orqali tekshiradi */
function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  const a = Buffer.from(calculated, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null;

  try {
    return JSON.parse(params.get('user') || 'null');
  } catch {
    return null;
  }
}

async function telegramAuth(req, res, next) {
  try {
    const initData = req.get('X-Telegram-Init-Data');
    const user = verifyInitData(initData, config.botToken);
    if (!user?.id) {
      return res.status(401).json({ error: "Ilovani Telegram ichidan oching. Sessiya muddati tugagan bo'lsa, ilovani yopib qayta oching." });
    }
    let employee = await Employee.findByTelegramId(user.id);
    if (!employee && String(user.id) === config.directorTelegramId) {
      const director = await Employee.getDirector();
      if (director && !director.telegramId) employee = await Employee.linkTelegram(director.id, user.id);
    }
    if (!employee) {
      return res.status(403).json({ error: "Siz tizimda ro'yxatdan o'tmagansiz. Avval botga /start yozib, telefon raqamingizni yuboring." });
    }
    req.employee = employee;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { telegramAuth, verifyInitData };
