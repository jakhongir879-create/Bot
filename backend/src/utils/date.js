const { tzOffsetHours } = require('../config/default');

const OFFSET = tzOffsetHours * 3600 * 1000;
const DAY = 24 * 3600 * 1000;

// UTC vaqtni Toshkent sanasiga aylantiradi: "2026-09-27"
function localKey(date) {
  return new Date(new Date(date).getTime() + OFFSET).toISOString().slice(0, 10);
}

function localHour(date) {
  return new Date(new Date(date).getTime() + OFFSET).getUTCHours();
}

// "2026-09-27" -> shu kun boshlanishi (UTC)
function startOfLocalDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - OFFSET);
}

function addDays(key, n) {
  return localKey(new Date(startOfLocalDay(key).getTime() + n * DAY));
}

function todayKey() {
  return localKey(new Date());
}

function formatKey(key) {
  const [y, m, d] = key.split('-');
  return `${d}.${m}.${y}`;
}

const PERIOD_LABELS = {
  today: 'Bugun',
  yesterday: 'Kecha',
  week: "So'nggi 7 kun",
  month: 'Joriy oy',
  lastMonth: "O'tgan oy",
  days30: "So'nggi 30 kun",
  year: 'Joriy yil',
  custom: 'Tanlangan davr',
};

/**
 * Davrni aniqlaydi. Natija: { from, to, fromKey, toKey, label, days }
 * "to" - eksklyuziv (keyingi kun boshlanishi).
 */
function resolveRange(period = 'today', fromKey, toKey) {
  const today = todayKey();
  let a;
  let b;
  switch (period) {
    case 'yesterday':
      a = b = addDays(today, -1);
      break;
    case 'week':
      a = addDays(today, -6);
      b = today;
      break;
    case 'days30':
      a = addDays(today, -29);
      b = today;
      break;
    case 'month':
      a = today.slice(0, 8) + '01';
      b = today;
      break;
    case 'lastMonth': {
      const firstThis = today.slice(0, 8) + '01';
      b = addDays(firstThis, -1);
      a = b.slice(0, 8) + '01';
      break;
    }
    case 'year':
      a = today.slice(0, 5) + '01-01';
      b = today;
      break;
    case 'custom':
      a = fromKey || today;
      b = toKey || a;
      if (a > b) [a, b] = [b, a];
      break;
    default:
      period = 'today';
      a = b = today;
  }
  const from = startOfLocalDay(a);
  const to = startOfLocalDay(addDays(b, 1));
  const days = Math.round((to - from) / DAY);
  const label =
    period === 'custom'
      ? a === b
        ? formatKey(a)
        : `${formatKey(a)} — ${formatKey(b)}`
      : PERIOD_LABELS[period];
  return { period, from, to, fromKey: a, toKey: b, label, days };
}

// Solishtirish uchun oldingi teng davr
function previousRange(range) {
  const len = range.days;
  const toKey = addDays(range.fromKey, -1);
  const fromKey = addDays(range.fromKey, -len);
  return resolveRange('custom', fromKey, toKey);
}

module.exports = {
  localKey,
  localHour,
  startOfLocalDay,
  addDays,
  todayKey,
  formatKey,
  resolveRange,
  previousRange,
  PERIOD_LABELS,
};
