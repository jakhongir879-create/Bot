// Boshlang'ich (namuna) maʼlumotlar: kategoriyalar, mahsulotlar, mijozlar
// va so'nggi 60 kunlik sotuv/xarajatlar — dashboard bo'sh ko'rinmasligi uchun.
// Qayta ishga tushirilsa, mavjud maʼlumotlarga tegmaydi.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const OFFSET = 5 * 3600 * 1000; // Toshkent

const CATEGORIES = ['Pitsa', 'Ichimliklar', 'Fast-fud', 'Desertlar'];
const PRODUCTS = [
  ['Margarita', 'Pitsa', 38000, 65000, 'dona'],
  ['Peperoni', 'Pitsa', 45000, 79000, 'dona'],
  ['Qazi pitsa', 'Pitsa', 52000, 89000, 'dona'],
  ["Pishloqli pitsa", 'Pitsa', 42000, 72000, 'dona'],
  ['Coca-Cola 1L', 'Ichimliklar', 7000, 12000, 'dona'],
  ['Fanta 1L', 'Ichimliklar', 7000, 12000, 'dona'],
  ['Choy', 'Ichimliklar', 1000, 5000, 'dona'],
  ['Lavash', 'Fast-fud', 16000, 32000, 'dona'],
  ['Burger', 'Fast-fud', 18000, 35000, 'dona'],
  ['Kartoshka fri', 'Fast-fud', 6000, 15000, 'dona'],
  ['Chizkeyk', 'Desertlar', 14000, 28000, 'dona'],
];
const CUSTOMERS = [
  ['Aziz Karimov', '+998901112233'],
  ['Dilnoza Rahimova', '+998935556677'],
  ['Sardor Aliyev', '+998971234567'],
  ["Mohira To'xtayeva", '+998998887766'],
];
const EXPENSES = [
  ['Xomashyo', 150000, 450000],
  ['Kommunal', 80000, 200000],
  ['Transport', 30000, 90000],
  ['Reklama', 50000, 250000],
  ['Boshqa', 20000, 80000],
];

const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[rand(0, arr.length - 1)];

function localDate(daysAgo, hour, minute) {
  const now = new Date(Date.now() + OFFSET);
  const d = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo, hour, minute);
  return new Date(d - OFFSET);
}

async function main() {
  console.log('🌱 Seed boshlandi...');

  for (const name of CATEGORIES) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }
  const cats = Object.fromEntries((await prisma.category.findMany()).map((c) => [c.name, c.id]));

  if ((await prisma.product.count()) === 0) {
    for (const [name, cat, costPrice, salePrice, unit] of PRODUCTS) {
      await prisma.product.create({
        data: { name, unit, costPrice, salePrice, stock: rand(40, 120), minStock: 10, categoryId: cats[cat] },
      });
    }
    console.log(`✅ ${PRODUCTS.length} ta mahsulot qo'shildi`);
  }

  if ((await prisma.customer.count()) === 0) {
    for (const [name, phone] of CUSTOMERS) await prisma.customer.create({ data: { name, phone } });
    console.log(`✅ ${CUSTOMERS.length} ta mijoz qo'shildi`);
  }

  if ((await prisma.sale.count()) === 0) {
    const products = await prisma.product.findMany();
    const customers = await prisma.customer.findMany();
    let count = 0;
    for (let day = 59; day >= 0; day--) {
      const weekend = [0, 6].includes(localDate(day, 12, 0).getUTCDay());
      const n = rand(6, 14) + (weekend ? 5 : 0);
      for (let i = 0; i < n; i++) {
        const hour = day === 0 ? rand(9, Math.max(9, new Date(Date.now() + OFFSET).getUTCHours())) : rand(9, 22);
        const createdAt = localDate(day, hour, rand(0, 59));
        if (createdAt > new Date()) continue;
        const lines = Array.from({ length: rand(1, 3) }, () => {
          const p = pick(products);
          const quantity = rand(1, 3);
          return {
            productId: p.id,
            productName: p.name,
            quantity,
            price: p.salePrice,
            costPrice: p.costPrice,
            total: p.salePrice * quantity,
          };
        });
        const subtotal = lines.reduce((s, l) => s + l.total, 0);
        const discount = Math.random() < 0.1 ? Math.round(subtotal * 0.1 / 1000) * 1000 : 0;
        const total = subtotal - discount;
        const costTotal = lines.reduce((s, l) => s + l.costPrice * l.quantity, 0);
        const r = Math.random();
        const paymentMethod = r < 0.45 ? 'CASH' : r < 0.8 ? 'CARD' : r < 0.94 ? 'TRANSFER' : 'DEBT';
        const debt = paymentMethod === 'DEBT';
        await prisma.sale.create({
          data: {
            subtotal,
            discount,
            total,
            costTotal,
            profit: total - costTotal,
            paidAmount: debt ? (Math.random() < 0.5 ? 0 : Math.round(total / 2)) : total,
            paymentMethod,
            customerId: debt || Math.random() < 0.3 ? pick(customers).id : null,
            createdAt,
            items: { create: lines },
          },
        });
        count++;
      }
      // Xarajatlar
      for (const [category, min, max] of EXPENSES) {
        if (Math.random() < 0.35) {
          await prisma.expense.create({
            data: { category, amount: Math.round(rand(min, max) / 1000) * 1000, date: localDate(day, rand(9, 20), 0) },
          });
        }
      }
      if (localDate(day, 12, 0).getUTCDate() === 1 || day === 59) {
        await prisma.expense.create({ data: { category: 'Ijara', amount: 3000000, note: 'Oylik ijara', date: localDate(day, 10, 0) } });
        await prisma.expense.create({ data: { category: 'Ish haqi', amount: 8000000, note: 'Xodimlar maoshi', date: localDate(day, 11, 0) } });
      }
    }
    console.log(`✅ ${count} ta namuna sotuv va xarajatlar qo'shildi`);
  }

  console.log('🎉 Seed tugadi!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
