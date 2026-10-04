const XLSX = require('xlsx');
const StockCheck = require('../models/StockCheck');
const { config } = require('../config/default');

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

class StockError extends Error {}

/* Ustun nomlarining turli variantlari. Tartib muhim: "Фактический остаток" avval "haqiqiy" deb tanilishi kerak. */
const COLUMN_ALIASES = {
  diffQty: ['farq', 'разница', 'отклонение', 'расхождение', 'difference', 'tafovut'],
  actual: ['haqiqiy', 'fakt', 'факт', 'sanoq', 'sanalgan', 'подсчет', 'подсчёт', 'actual', 'counted', 'inventar'],
  system: ['qoldiq', 'ostatok', 'остаток', 'dastur', 'hisobdagi', 'kitob', 'учет', 'учёт', 'учетн', 'system', 'book', 'balance', 'programma'],
  code: ['kod', 'код', 'code', 'artikul', 'артикул', 'sku', 'shtrix', 'штрих', 'barcode'],
  name: ['nomi', 'nom', 'наименование', 'название', 'name', 'tovar', 'товар', 'mahsulot', 'номенклатура', 'product', 'item'],
  price: ['narx', 'narxi', 'цена', 'price', 'tannarx', 'себестоимость', 'стоимость', 'cost'],
  responsible: ["mas'ul", 'masul', 'масъул', 'ответствен', 'мол', 'responsible', 'javobgar', 'omborchi', 'kladovshik', 'кладовщик'],
};

function normalizeHeader(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[ʻʼ‘’`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function detectColumn(header) {
  const h = normalizeHeader(header);
  if (!h) return null;
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some((alias) => h.includes(alias))) return key;
  }
  return null;
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? '')
    .replace(/\s| | /g, '')
    .replace(/so'?m|сум|uzs/gi, '')
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function findHeaderRow(rows) {
  let best = { index: -1, map: null, score: 0 };
  const limit = Math.min(rows.length, 15);
  for (let i = 0; i < limit; i += 1) {
    const map = {};
    (rows[i] || []).forEach((cell, col) => {
      const key = detectColumn(cell);
      if (key && map[key] === undefined) map[key] = col;
    });
    const score = Object.keys(map).length;
    if (score > best.score) best = { index: i, map, score };
  }
  return best;
}

function parseWorkbook(buffer) {
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw new StockError("Faylni o'qib bo'lmadi. Excel (.xlsx, .xls) yoki .csv fayl yuboring.");
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new StockError('Faylda varaq topilmadi.');
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true });

  const { index, map } = findHeaderRow(rows);
  if (index < 0 || map.name === undefined || map.actual === undefined || (map.system === undefined && map.diffQty === undefined)) {
    throw new StockError(
      "Ustunlar tanilmadi. Faylda kamida quyidagi ustunlar bo'lishi kerak: \"Nomi\", \"Qoldiq\" (dasturdagi) va \"Haqiqiy\" (sanoq). Namunaviy shablonni Dashboard'dan yuklab olishingiz mumkin.",
    );
  }

  const items = [];
  for (let i = index + 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const name = String(row[map.name] ?? '').trim();
    if (!name) continue;
    if (/^(jami|итого|всего|total)/i.test(name)) continue;
    const actualQty = toNumber(row[map.actual]);
    const systemQty = map.system !== undefined ? toNumber(row[map.system]) : actualQty - toNumber(row[map.diffQty]);
    const price = map.price !== undefined ? toNumber(row[map.price]) : 0;
    const diffQty = Math.round((actualQty - systemQty) * 1000) / 1000;
    items.push({
      code: map.code !== undefined ? String(row[map.code] ?? '').trim() || null : null,
      name: name.slice(0, 200),
      systemQty,
      actualQty,
      price,
      diffQty,
      diffSum: Math.round(diffQty * price),
      responsible: map.responsible !== undefined ? String(row[map.responsible] ?? '').trim() || null : null,
    });
  }
  if (!items.length) throw new StockError("Faylda tovarlar topilmadi.");
  if (items.length > 200000) throw new StockError("Fayl juda katta (200 000 qatordan ko'p).");
  return { items, detectedColumns: map };
}

function validateFile(fileName, size) {
  const lower = String(fileName || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    throw new StockError('Faqat Excel (.xlsx, .xls) yoki .csv fayl qabul qilinadi.');
  }
  if (size > config.maxUploadBytes) {
    throw new StockError("Fayl hajmi 20 MB dan oshmasligi kerak.");
  }
}

async function processStockFile({ buffer, fileName, warehouse, responsible, checkDate }) {
  validateFile(fileName, buffer.length);
  const { items } = parseWorkbook(buffer);
  const check = await StockCheck.createWithItems({
    checkDate: checkDate || new Date(),
    warehouse: (warehouse || 'Asosiy sklad').slice(0, 100),
    responsible: (responsible || "Ko'rsatilmagan").slice(0, 100),
    fileName: String(fileName).slice(0, 200),
    items: items.map((item) => ({ ...item, responsible: item.responsible || responsible || null })),
  });
  const withDiff = items.filter((i) => i.diffQty !== 0);
  const top = [...withDiff].sort((a, b) => Math.abs(b.diffSum) - Math.abs(a.diffSum)).slice(0, 5);
  return { check, itemsWithDiff: withDiff.length, top };
}

function buildTemplate() {
  const rows = [
    ['Kod', 'Nomi', 'Dasturdagi qoldiq', 'Haqiqiy sanoq', 'Narx', "Mas'ul shaxs"],
    ['A-001', 'Shakar 1 kg', 120, 118, 14000, 'Karimov Aziz'],
    ['A-002', "Un 50 kg (qop)", 40, 40, 310000, 'Karimov Aziz'],
    ['A-003', "Kungaboqar yog'i 1 l", 200, 205, 21000, 'Karimov Aziz'],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 10 }, { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 20 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sverka');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { StockError, ALLOWED_EXTENSIONS, parseWorkbook, validateFile, processStockFile, buildTemplate, detectColumn };
