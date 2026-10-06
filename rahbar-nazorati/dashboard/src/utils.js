const TZ = 'Asia/Tashkent';

function partsOf(date) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const p = Object.fromEntries(f.formatToParts(new Date(date)).map((x) => [x.type, x.value]));
  return { ...p, hour: p.hour === '24' ? '00' : p.hour };
}

export function formatDate(date) {
  if (!date) return '—';
  const p = partsOf(date);
  return `${p.day}.${p.month}.${p.year}`;
}

export function formatDateTime(date) {
  if (!date) return '—';
  const p = partsOf(date);
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

export function isoDay(date = new Date()) {
  const p = partsOf(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function groupDigits(value) {
  const n = Math.round(Number(value) || 0);
  return (n < 0 ? '-' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function money(value) {
  return `${groupDigits(value)} so'm`;
}

export function compactMoney(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2).replace('.', ',').replace(/0$/, '').replace(/,$/, '')} mlrd`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',').replace(/,0$/, '')} mln`;
  if (abs >= 1e3) return `${Math.round(n / 1e3)} ming`;
  return String(Math.round(n));
}

export function num(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(digits).replace('.', ',').replace(/,0+$/, '');
}

export function pct(value, digits = 1) {
  return value === null || value === undefined ? '—' : `${num(value, digits)}%`;
}

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const MONTHS_SHORT = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

export function monthLabel(key, short = false) {
  if (!key) return '—';
  const [y, m] = key.split('-').map(Number);
  return short ? `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}` : `${MONTHS[m - 1]} ${y}`;
}

export function currentMonthKey() {
  return isoDay().slice(0, 7);
}

export const STATUS = {
  YANGI: { label: 'Yangi', tone: 'blue' },
  QABUL_QILINDI: { label: 'Qabul qilindi', tone: 'blue' },
  JARAYONDA: { label: 'Jarayonda', tone: 'yellow' },
  BAJARILDI: { label: 'Bajarildi', tone: 'green' },
  BAJARILMADI: { label: 'Bajarilmadi', tone: 'red' },
  QAYTARILDI: { label: 'Qaytarildi', tone: 'orange' },
  MUDDATI_OTGAN: { label: "Muddati o'tgan", tone: 'red' },
};

export const PRIORITY = { PAST: { label: 'Past', tone: 'green' }, ORTA: { label: "O'rta", tone: 'yellow' }, YUQORI: { label: 'Yuqori', tone: 'red' } };

export const KPI_LEVELS = { 1: 'Juda past', 2: 'Past', 3: "O'rta", 4: 'Yuqori', 5: 'Juda muhim' };

export const REASONS = {
  RESURS_YETMADI: 'Resurs yetmadi',
  BOSHQA_BOLIMGA_BOGLIQ: "Boshqa bo'limga bog'liq",
  VAQT_YETMADI: 'Vaqt yetmadi',
  TOPSHIRIQ_NOANIQ: 'Topshiriq noaniq',
  BOSHQA: 'Boshqa',
};

export const ROLES = { DIRECTOR: 'Direktor', TOP: 'Top manager', MIDDLE: 'Middle manager' };

export const MODULES = {
  UMUMIY: 'Umumiy',
  VAZIFALAR: 'Vazifalar',
  FAOLLIK: 'Xodimlar faolligi',
  SKLAD: 'Sklad sverka',
  MOLIYA: 'Moliya va strategiya',
};

export const VERDICTS = {
  OZINI_OQLADI: { label: "O'zini oqladi", tone: 'green' },
  OQLAMADI: { label: 'Oqlamadi', tone: 'red' },
  HALI_ERTA: { label: 'Hali erta', tone: 'muted' },
};

export const GOAL_STATUS = {
  BAJARILDI: { label: 'Bajarildi', tone: 'green', icon: '✓' },
  XAVF_OSTIDA: { label: 'Xavf ostida', tone: 'yellow', icon: '!' },
  BAJARILMADI: { label: 'Bajarilmadi', tone: 'red', icon: '✕' },
  NOMA_LUM: { label: "Ma'lumot yetarli emas", tone: 'muted', icon: '?' },
};

export function scoreTone(score) {
  if (score === null || score === undefined) return 'muted';
  if (score >= 75) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}

export function isDark() {
  const forced = document.documentElement.dataset.theme;
  if (forced) return forced === 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

/** Validatsiyadan o'tgan kategorik palitra (1–3 slot) va diagramma bezaklari */
export function chartColors() {
  const dark = isDark();
  return dark
    ? { s1: '#3987e5', s2: '#d95926', s3: '#199e70', s4: '#c98500', s5: '#d55181', grid: '#2c2c2a', axis: '#898781', baseline: '#383835', surface: '#1c1c1e', text: '#ffffff', text2: '#c3c2b7', good: '#0ca30c', critical: '#d03b3b', warning: '#fab219' }
    : { s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', s4: '#eda100', s5: '#e87ba4', grid: '#e1e0d9', axis: '#898781', baseline: '#c3c2b7', surface: '#ffffff', text: '#0b0b0b', text2: '#52514e', good: '#0ca30c', critical: '#d03b3b', warning: '#fab219' };
}
