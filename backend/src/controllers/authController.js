const crypto = require('crypto');
const config = require('../config/default');
const Admin = require('../models/Admin');
const { sign } = require('../middlewares/auth.middleware');
const { verifyInitData } = require('../utils/telegram');

function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

async function login(req, res) {
  if (!safeEqual(req.body.password || '', config.adminPassword)) {
    return res.status(401).json({ message: "Parol noto'g'ri" });
  }
  const user = { id: null, name: 'Administrator', role: 'OWNER' };
  res.json({ token: sign(user), user });
}

// Telegram Mini App orqali avtomatik kirish
async function telegramLogin(req, res) {
  const tgUser = verifyInitData(req.body.initData, config.botToken);
  if (!tgUser) return res.status(401).json({ message: "Telegram maʼlumotlari noto'g'ri" });
  const admin = await Admin.resolve(tgUser);
  if (!admin) return res.status(403).json({ message: `Ruxsat yo'q. Telegram ID: ${tgUser.id}` });
  const user = { id: admin.id, name: admin.name, role: admin.role };
  res.json({ token: sign(user), user });
}

async function me(req, res) {
  res.json({ user: req.user, businessName: config.businessName });
}

module.exports = { login, telegramLogin, me };
