const jwt = require('jsonwebtoken');
const config = require('../config/default');

function sign(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  if (!token) return res.status(401).json({ message: 'Avval tizimga kiring' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ message: 'Sessiya tugagan, qayta kiring' });
  }
}

function requireOwner(req, res, next) {
  if (req.user?.role !== 'OWNER') return res.status(403).json({ message: 'Faqat biznes egasi uchun' });
  return next();
}

// Majburiy maydonlarni tekshirish
function validate(fields) {
  return (req, res, next) => {
    const missing = fields.filter((f) => req.body?.[f] === undefined || req.body?.[f] === null || req.body?.[f] === '');
    if (missing.length) return res.status(400).json({ message: `To'ldirilmagan maydonlar: ${missing.join(', ')}` });
    return next();
  };
}

module.exports = { sign, requireAuth, requireOwner, validate };
