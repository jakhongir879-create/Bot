const TZ = 'Asia/Tashkent';

function partsOf(date) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
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

export function toLocalInput(date) {
  const p = partsOf(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function fromLocalInput(value) {
  return new Date(`${value}:00+05:00`);
}

export function timeLeft(deadline) {
  const ms = new Date(deadline).getTime() - Date.now();
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const minutes = Math.floor((abs % 3600000) / 60000);
  let text;
  if (days > 0) text = `${days} kun ${hours} soat`;
  else if (hours > 0) text = `${hours} soat ${minutes} daq`;
  else text = `${minutes} daq`;
  return ms >= 0 ? `${text} qoldi` : `${text} kechikdi`;
}

export function deadlineTone(task) {
  if (['BAJARILDI', 'BAJARILMADI'].includes(task.status)) return 'muted';
  const ms = new Date(task.deadline).getTime() - Date.now();
  if (ms < 0) return 'red';
  if (ms < 24 * 3600000) return 'yellow';
  return 'green';
}

export const STATUS = {
  YANGI: { label: 'Yangi', tone: 'blue' },
  QABUL_QILINDI: { label: 'Qabul qilindi', tone: 'blue' },
  JARAYONDA: { label: 'Jarayonda', tone: 'yellow' },
  BAJARILDI: { label: 'Bajarildi', tone: 'green' },
  BAJARILMADI: { label: 'Bajarilmadi', tone: 'red' },
  QAYTARILDI: { label: 'Qaytarildi', tone: 'orange' },
};

export const PRIORITY = {
  PAST: { label: 'Past', tone: 'green' },
  ORTA: { label: "O'rta", tone: 'yellow' },
  YUQORI: { label: 'Yuqori', tone: 'red' },
};

export const REASONS = [
  { key: 'RESURS_YETMADI', label: 'Resurs yetmadi' },
  { key: 'BOSHQA_BOLIMGA_BOGLIQ', label: "Boshqa bo'limga bog'liq" },
  { key: 'VAQT_YETMADI', label: 'Vaqt yetmadi' },
  { key: 'TOPSHIRIQ_NOANIQ', label: 'Topshiriq noaniq' },
  { key: 'BOSHQA', label: 'Boshqa (yozing)' },
];

export const REASON_LABEL = Object.fromEntries(REASONS.map((r) => [r.key, r.label.replace(' (yozing)', '')]));

export function scoreTone(score) {
  if (score === null || score === undefined) return 'muted';
  if (score >= 75) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function fmt(value, digits = 1) {
  if (value === null || value === undefined) return '—';
  return Number(value).toFixed(digits).replace('.', ',').replace(/,0$/, '');
}
