const ROLE_LABELS = {
  DIRECTOR: 'Direktor',
  TOP: 'Top manager',
  MIDDLE: 'Middle manager',
};

const STATUS_LABELS = {
  YANGI: 'Yangi',
  QABUL_QILINDI: 'Qabul qilindi',
  JARAYONDA: 'Jarayonda',
  BAJARILDI: 'Bajarildi',
  BAJARILMADI: 'Bajarilmadi',
  QAYTARILDI: 'Qaytarildi',
};

const STATUS_ICONS = {
  YANGI: '🆕',
  QABUL_QILINDI: '👌',
  JARAYONDA: '⏳',
  BAJARILDI: '✅',
  BAJARILMADI: '❌',
  QAYTARILDI: '🔁',
};

const PRIORITY_LABELS = {
  PAST: 'Past',
  ORTA: "O'rta",
  YUQORI: 'Yuqori',
};

const PRIORITY_ICONS = {
  PAST: '🟢',
  ORTA: '🟡',
  YUQORI: '🔴',
};

const REASON_LABELS = {
  RESURS_YETMADI: 'Resurs yetmadi',
  BOSHQA_BOLIMGA_BOGLIQ: "Boshqa bo'limga bog'liq",
  VAQT_YETMADI: 'Vaqt yetmadi',
  TOPSHIRIQ_NOANIQ: 'Topshiriq noaniq',
  BOSHQA: 'Boshqa',
};

const FINANCE_TYPE_LABELS = {
  TUSHUM: 'Tushum',
  TANNARX: 'Tannarx',
  XARAJAT: 'Xarajat',
};

const VERDICT_LABELS = {
  OZINI_OQLADI: "O'zini oqladi",
  OQLAMADI: 'Oqlamadi',
  HALI_ERTA: 'Hali erta',
};

const MODULE_LABELS = {
  VAZIFALAR: 'Vazifalar',
  FAOLLIK: 'Xodimlar faolligi',
  SKLAD: 'Sklad sverka',
  MOLIYA: 'Moliya va strategiya',
  UMUMIY: 'Umumiy',
};

const METRICS = {
  SOF_MARJA: { label: 'Sof foyda marjasi', unit: '%', better: 'up' },
  YALPI_MARJA: { label: 'Yalpi marja', unit: '%', better: 'up' },
  TUSHUM_OSISHI: { label: "Tushumning oylik o'sishi", unit: '%', better: 'up' },
  XARAJAT_ULUSHI: { label: 'Xarajatlarning tushumdagi ulushi', unit: '%', better: 'down' },
  TANNARX_ULUSHI: { label: 'Tannarxning tushumdagi ulushi', unit: '%', better: 'down' },
  REJA_BAJARILISHI: { label: 'Tushum rejasining bajarilishi', unit: '%', better: 'up' },
  TOIFA_ULUSHI: { label: 'Xarajat toifasining tushumdagi ulushi', unit: '%', better: 'down' },
  TUSHUM: { label: 'Oylik tushum', unit: "so'm", better: 'up' },
  SOF_FOYDA: { label: 'Oylik sof foyda', unit: "so'm", better: 'up' },
};

const EXPENSE_CATEGORIES = ['Ish haqi', 'Ijara', 'Marketing', 'Logistika', 'Kommunal', 'Boshqa'];

module.exports = {
  ROLE_LABELS,
  STATUS_LABELS,
  STATUS_ICONS,
  PRIORITY_LABELS,
  PRIORITY_ICONS,
  REASON_LABELS,
  FINANCE_TYPE_LABELS,
  VERDICT_LABELS,
  MODULE_LABELS,
  METRICS,
  EXPENSE_CATEGORIES,
};
