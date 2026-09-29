const TZ = 'Asia/Tashkent';
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function groupDigits(value) {
  const rounded = Math.round(Number(value) || 0);
  const sign = rounded < 0 ? '-' : '';
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatMoney(value) {
  return `${groupDigits(value)} so'm`;
}

function formatNumber(value, digits = 0) {
  const n = Number(value) || 0;
  if (digits === 0) return groupDigits(n);
  const [int, frac] = Math.abs(n).toFixed(digits).split('.');
  return `${n < 0 ? '-' : ''}${groupDigits(int)},${frac}`;
}

function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${formatNumber(value, digits)}%`;
}

function parts(date) {
  const d = new Date(new Date(date).getTime() + TZ_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

const pad = (n) => String(n).padStart(2, '0');

function formatDate(date) {
  if (!date) return '—';
  const p = parts(date);
  return `${pad(p.day)}.${pad(p.month)}.${p.year}`;
}

function formatDateTime(date) {
  if (!date) return '—';
  const p = parts(date);
  return `${pad(p.day)}.${pad(p.month)}.${p.year} ${pad(p.hour)}:${pad(p.minute)}`;
}

function tashkentDate(year, month, day, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - TZ_OFFSET_MS);
}

function startOfDay(date = new Date()) {
  const p = parts(date);
  return tashkentDate(p.year, p.month, p.day);
}

function endOfDay(date = new Date()) {
  return new Date(startOfDay(date).getTime() + DAY_MS - 1);
}

function addDays(date, days) {
  return new Date(new Date(date).getTime() + days * DAY_MS);
}

function startOfWeek(date = new Date()) {
  const p = parts(date);
  const diff = (p.weekday + 6) % 7;
  return addDays(tashkentDate(p.year, p.month, p.day), -diff);
}

function monthKey(date = new Date()) {
  const p = parts(date);
  return `${p.year}-${pad(p.month)}`;
}

function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function parseDateInput(text) {
  const match = String(text || '').trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:\s+(\d{1,2})[:.](\d{2}))?$/);
  if (!match) return null;
  let [, d, m, y, hh, mm] = match;
  y = Number(y.length === 2 ? `20${y}` : y);
  const day = Number(d);
  const month = Number(m);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const hour = hh !== undefined ? Number(hh) : 18;
  const minute = mm !== undefined ? Number(mm) : 0;
  if (hour > 23 || minute > 59) return null;
  const result = tashkentDate(y, month, day, hour, minute);
  const check = parts(result);
  if (check.day !== day || check.month !== month) return null;
  return result;
}

function timeLeft(deadline, now = new Date()) {
  const ms = new Date(deadline).getTime() - now.getTime();
  const abs = Math.abs(ms);
  const days = Math.floor(abs / DAY_MS);
  const hours = Math.floor((abs % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((abs % HOUR_MS) / 60000);
  let text;
  if (days > 0) text = `${days} kun ${hours} soat`;
  else if (hours > 0) text = `${hours} soat ${minutes} daqiqa`;
  else text = `${minutes} daqiqa`;
  return ms >= 0 ? `${text} qoldi` : `${text} kechikdi`;
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
  return digits ? `+${digits}` : '';
}

module.exports = {
  TZ,
  DAY_MS,
  HOUR_MS,
  formatMoney,
  formatNumber,
  formatPercent,
  formatDate,
  formatDateTime,
  tashkentDate,
  startOfDay,
  endOfDay,
  startOfWeek,
  addDays,
  monthKey,
  shiftMonth,
  monthLabel,
  parseDateInput,
  parts,
  timeLeft,
  escapeHtml,
  normalizePhone,
};
