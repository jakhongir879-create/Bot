export const money = (n) =>
  `${Math.round(Number(n) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`;

export const num = (n) =>
  (Math.round((Number(n) || 0) * 100) / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export const short = (n) => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)} mlrd`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)} mln`;
  if (a >= 1e3) return `${Math.round(v / 1e3)} ming`;
  return String(Math.round(v));
};

export const dateTime = (d) =>
  new Date(d).toLocaleString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const dayLabel = (key) => {
  const [, m, d] = key.split('-');
  return `${d}.${m}`;
};

export const todayKey = () =>
  new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);

export const PAYMENT = { CASH: 'Naqd', CARD: 'Karta', TRANSFER: "O'tkazma", DEBT: 'Nasiya' };

export const PERIODS = [
  ['today', 'Bugun'],
  ['yesterday', 'Kecha'],
  ['week', '7 kun'],
  ['days30', '30 kun'],
  ['month', 'Joriy oy'],
  ['lastMonth', "O'tgan oy"],
  ['year', 'Yil'],
  ['custom', 'Tanlash'],
];
