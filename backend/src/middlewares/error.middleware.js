function errorHandler(err, req, res, _next) {
  if (err.code === 'P2025') return res.status(404).json({ message: 'Maʼlumot topilmadi' });
  if (err.code === 'P2002') return res.status(400).json({ message: 'Bunday maʼlumot allaqachon mavjud' });
  if (err.code === 'P2003') return res.status(400).json({ message: "Bog'liq maʼlumotlar bor, o'chirib bo'lmaydi" });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 ? 'Server xatosi' : err.message });
}

// async handlerlardagi xatolarni ushlash
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { errorHandler, wrap };
