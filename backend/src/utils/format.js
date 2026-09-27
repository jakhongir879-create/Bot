function money(n) {
  const v = Math.round(Number(n) || 0);
  const s = Math.abs(v)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${v < 0 ? '-' : ''}${s} so'm`;
}

function short(n) {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)} mlrd`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)} mln`;
  if (a >= 1e3) return `${Math.round(v / 1e3)} ming`;
  return String(Math.round(v));
}

function qty(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '');
}

function change(cur, prev) {
  if (!prev) return cur ? null : 0;
  return Math.round(((cur - prev) / Math.abs(prev)) * 100);
}

function changeText(cur, prev) {
  const c = change(cur, prev);
  if (c === null) return '🆕';
  if (c === 0) return '▪️ 0%';
  return c > 0 ? `🔺 ${c}%` : `🔻 ${Math.abs(c)}%`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { money, short, qty, change, changeText, escapeHtml };
