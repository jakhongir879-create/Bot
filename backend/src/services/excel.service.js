const ExcelJS = require('exceljs');
const prisma = require('../database/connection');
const config = require('../config/default');
const report = require('./report.service');
const Product = require('../models/Product');
const { resolveRange, localKey, formatKey } = require('../utils/date');

const MONEY = '#,##0" so\'m"';

function styleHeader(sheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A78D6' } };
  row.alignment = { vertical: 'middle' };
  row.height = 22;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function tashkentTime(d) {
  const t = new Date(new Date(d).getTime() + config.tzOffsetHours * 3600000);
  return `${formatKey(localKey(d))} ${t.toISOString().slice(11, 16)}`;
}

async function buildWorkbook(period = 'month', from, to) {
  const range = resolveRange(period, from, to);
  const { summary, data } = await report.summary(range);
  const series = report.dailySeries(range, data);
  const products = await Product.list();

  const wb = new ExcelJS.Workbook();
  wb.creator = config.businessName;

  // 1. Umumiy
  const s1 = wb.addWorksheet('Umumiy');
  s1.columns = [
    { header: "Ko'rsatkich", key: 'k', width: 32 },
    { header: 'Qiymat', key: 'v', width: 22 },
  ];
  const rows = [
    ['Biznes', config.businessName],
    ['Davr', range.label],
    ['Tushum', summary.revenue],
    ['Tannarx', summary.costTotal],
    ['Yalpi foyda', summary.grossProfit],
    ['Xarajatlar', summary.expenses],
    ['Sof foyda', summary.netProfit],
    ['Sotuvlar soni', summary.salesCount],
    ["O'rtacha chek", summary.avgCheck],
    ['Chegirmalar', summary.discount],
    ['Yangi nasiya', summary.newDebt],
    ['Marja, %', summary.margin],
  ];
  rows.forEach(([k, v]) => {
    const r = s1.addRow({ k, v });
    if (typeof v === 'number' && !['Sotuvlar soni', 'Marja, %'].includes(k)) r.getCell('v').numFmt = MONEY;
  });
  styleHeader(s1);

  // 2. Kunlik
  const s2 = wb.addWorksheet('Kunlik');
  s2.columns = [
    { header: 'Sana', key: 'date', width: 14 },
    { header: 'Sotuvlar', key: 'salesCount', width: 10 },
    { header: 'Tushum', key: 'revenue', width: 18, style: { numFmt: MONEY } },
    { header: 'Yalpi foyda', key: 'profit', width: 18, style: { numFmt: MONEY } },
    { header: 'Xarajat', key: 'expenses', width: 18, style: { numFmt: MONEY } },
    { header: 'Sof foyda', key: 'netProfit', width: 18, style: { numFmt: MONEY } },
  ];
  series.forEach((d) => s2.addRow({ ...d, date: formatKey(d.date) }));
  styleHeader(s2);

  // 3. Sotuvlar
  const s3 = wb.addWorksheet('Sotuvlar');
  s3.columns = [
    { header: '№', key: 'id', width: 8 },
    { header: 'Sana', key: 'date', width: 18 },
    { header: 'Mijoz', key: 'customer', width: 22 },
    { header: 'Mahsulotlar', key: 'items', width: 45 },
    { header: "To'lov turi", key: 'pay', width: 12 },
    { header: 'Chegirma', key: 'discount', width: 14, style: { numFmt: MONEY } },
    { header: 'Jami', key: 'total', width: 16, style: { numFmt: MONEY } },
    { header: "To'langan", key: 'paid', width: 16, style: { numFmt: MONEY } },
    { header: 'Foyda', key: 'profit', width: 16, style: { numFmt: MONEY } },
  ];
  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: range.from, lt: range.to } },
    include: { items: true, customer: true },
    orderBy: { createdAt: 'asc' },
  });
  sales.forEach((s) =>
    s3.addRow({
      id: s.id,
      date: tashkentTime(s.createdAt),
      customer: s.customer?.name || '—',
      items: s.items.map((i) => `${i.productName} × ${i.quantity}`).join(', '),
      pay: config.paymentMethods[s.paymentMethod],
      discount: s.discount,
      total: s.total,
      paid: s.paidAmount,
      profit: s.profit,
    })
  );
  styleHeader(s3);

  // 4. Top mahsulotlar
  const s4 = wb.addWorksheet('Top mahsulotlar');
  s4.columns = [
    { header: 'Mahsulot', key: 'name', width: 30 },
    { header: 'Sotildi', key: 'quantity', width: 12 },
    { header: 'Tushum', key: 'revenue', width: 18, style: { numFmt: MONEY } },
    { header: 'Foyda', key: 'profit', width: 18, style: { numFmt: MONEY } },
  ];
  report.topProducts(data, 100).forEach((p) => s4.addRow(p));
  styleHeader(s4);

  // 5. Xarajatlar
  const s5 = wb.addWorksheet('Xarajatlar');
  s5.columns = [
    { header: 'Sana', key: 'date', width: 18 },
    { header: 'Turi', key: 'category', width: 18 },
    { header: 'Summa', key: 'amount', width: 18, style: { numFmt: MONEY } },
    { header: 'Izoh', key: 'note', width: 40 },
  ];
  data.expenses
    .sort((a, b) => a.date - b.date)
    .forEach((e) => s5.addRow({ date: tashkentTime(e.date), category: e.category, amount: e.amount, note: e.note || '' }));
  styleHeader(s5);

  // 6. Ombor
  const s6 = wb.addWorksheet('Ombor');
  s6.columns = [
    { header: 'Mahsulot', key: 'name', width: 30 },
    { header: 'Kategoriya', key: 'category', width: 18 },
    { header: 'Qoldiq', key: 'stock', width: 10 },
    { header: "O'lchov", key: 'unit', width: 10 },
    { header: 'Tannarx', key: 'costPrice', width: 16, style: { numFmt: MONEY } },
    { header: 'Sotish narxi', key: 'salePrice', width: 16, style: { numFmt: MONEY } },
    { header: 'Holati', key: 'status', width: 14 },
  ];
  products.forEach((p) =>
    s6.addRow({
      ...p,
      category: p.category?.name || '—',
      status: !p.isActive ? 'Nofaol' : p.stock <= p.minStock ? 'Kam qolgan' : 'Yetarli',
    })
  );
  styleHeader(s6);

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `hisobot_${range.fromKey}_${range.toKey}.xlsx`;
  return { buffer: Buffer.from(buffer), filename, range };
}

module.exports = { buildWorkbook };
