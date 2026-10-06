const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { config } = require('../config/default');
const Employee = require('../models/Employee');

const TOKEN_TTL = '12h';
const MAGIC_TTL = '10m';

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

/* ---------- Telegram orqali bir martalik kirish havolasi ---------- */

const usedMagic = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [nonce, exp] of usedMagic) if (exp < now) usedMagic.delete(nonce);
}, 10 * 60 * 1000).unref();

function createMagicToken(employee) {
  return jwt.sign({ typ: 'magic', emp: employee.id, nonce: crypto.randomBytes(8).toString('hex') }, config.jwtSecret, { expiresIn: MAGIC_TTL });
}

async function magicLogin(req, res) {
  let payload;
  try {
    payload = jwt.verify(String(req.body?.token || ''), config.jwtSecret);
  } catch {
    return res.status(401).json({ error: "Havola eskirgan. Botda «💻 Kompyuterda ochish» tugmasini qayta bosing." });
  }
  if (payload.typ !== 'magic' || usedMagic.has(payload.nonce)) {
    return res.status(401).json({ error: "Bu havola allaqachon ishlatilgan. Botdan yangi havola oling." });
  }
  usedMagic.set(payload.nonce, payload.exp * 1000);
  const employee = await Employee.findById(payload.emp);
  if (!employee || !employee.isActive || !['DIRECTOR', 'TOP'].includes(employee.role)) {
    return res.status(403).json({ error: "Kompyuter paneli faqat direktor va bo'lim boshliqlari uchun." });
  }
  const token = jwt.sign({ sub: 'employee', emp: employee.id }, config.jwtSecret, { expiresIn: TOKEN_TTL });
  return res.json({ token, login: employee.fullName });
}

/** So'rov kim nomidan kelganini aniqlaydi: req.viewer = { employee, role, scopeIds, isDirector } */
async function adminAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Tizimga kiring' });
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Sessiya muddati tugadi, qaytadan kiring' });
  }
  try {
    if (payload.sub === 'admin') {
      const director = await Employee.getDirector();
      req.viewer = { kind: 'admin', employee: director, role: 'DIRECTOR', isDirector: true, scopeIds: null, name: director?.fullName || config.adminLogin };
      return next();
    }
    if (payload.sub === 'employee') {
      const employee = await Employee.findById(payload.emp);
      if (!employee || !employee.isActive || !['DIRECTOR', 'TOP'].includes(employee.role)) {
        return res.status(401).json({ error: "Kirish huquqi bekor qilingan" });
      }
      const isDirector = employee.role === 'DIRECTOR';
      req.viewer = {
        kind: 'employee',
        employee,
        role: employee.role,
        isDirector,
        scopeIds: isDirector ? null : await Employee.getSubordinateIds(employee.id),
        name: employee.fullName,
      };
      return next();
    }
  } catch (error) {
    return next(error);
  }
  return res.status(401).json({ error: 'Tizimga kiring' });
}

function requireDirector(req, res, next) {
  if (req.viewer?.isDirector) return next();
  return res.status(403).json({ error: "Bu bo'lim faqat direktor uchun" });
}

module.exports = { adminAuth, login, magicLogin, createMagicToken, requireDirector };
