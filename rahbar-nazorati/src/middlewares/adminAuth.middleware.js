const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { config } = require('../config/default');

const TOKEN_TTL = '12h';

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/* Parol tanlashga urinishlarni cheklash: 15 daqiqada 10 ta noto'g'ri urinish */
const attempts = new Map();

function tooManyAttempts(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.first > 15 * 60 * 1000) return false;
  return entry.count >= 10;
}

function registerFailure(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.first > 15 * 60 * 1000) attempts.set(ip, { first: now, count: 1 });
  else entry.count += 1;
}

function login(req, res) {
  const ip = req.ip || 'unknown';
  if (tooManyAttempts(ip)) {
    return res.status(429).json({ error: "Juda ko'p noto'g'ri urinish. 15 daqiqadan keyin qayta urinib ko'ring." });
  }
  const { login: user, password } = req.body || {};
  const ok = safeEqual(user || '', config.adminLogin) & safeEqual(password || '', config.adminPassword);
  if (!ok) {
    registerFailure(ip);
    return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
  }
  attempts.delete(ip);
  const token = jwt.sign({ sub: 'admin', login: config.adminLogin }, config.jwtSecret, { expiresIn: TOKEN_TTL });
  return res.json({ token, login: config.adminLogin });
}

function adminAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Tizimga kiring' });
  try {
    req.admin = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ error: 'Sessiya muddati tugadi, qaytadan kiring' });
  }
}

module.exports = { adminAuth, login };
