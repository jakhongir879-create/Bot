const { config } = require('../src/config/default');
const { prisma } = require('../src/database/connection');
const { DAY_MS, HOUR_MS, monthKey, shiftMonth, tashkentDate, normalizePhone } = require('../src/utils/format');

/* Takrorlanadigan tasodifiy sonlar (har safar bir xil demo ma'lumot chiqishi uchun) */
let seed = 20260929;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (min, max) => min + rand() * (max - min);
const intBetween = (min, max) => Math.floor(between(min, max + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;

const DIRECTOR = {
  fullName: 'Bakhtiyor Abdukayumov',
  phone: '+998977702312',
  position: 'Direktor',
  department: 'Rahbariyat',
};

const TOPS = [
  { key: 'savdo', fullName: 'Rustamov Jasur', phone: '+998901110101', position: "Savdo bo'limi boshlig'i", department: 'Savdo', profile: 'good' },
  { key: 'moliya', fullName: 'Nazarova Dilnoza', phone: '+998901110102', position: 'Moliya direktori', department: 'Moliya', profile: 'good' },
  { key: 'logistika', fullName: 'Ergashev Bobur', phone: '+998901110103', position: "Logistika va sklad boshlig'i", department: 'Logistika', profile: 'avg' },
  { key: 'marketing', fullName: 'Toshmatov Sherzod', phone: '+998901110104', position: 'Marketing direktori', department: 'Marketing', profile: 'weak' },
];

const MIDDLES = [
  { top: 'savdo', fullName: 'Aliyev Sanjar', phone: '+998901110201', position: 'Ulgurji savdo menejeri', profile: 'good' },
  { top: 'savdo', fullName: 'Qodirova Malika', phone: '+998901110202', position: 'Chakana savdo menejeri', profile: 'avg' },
  { top: 'savdo', fullName: 'Hamidov Otabek', phone: '+998901110203', position: 'Savdo agenti', profile: 'weak' },
  { top: 'moliya', fullName: 'Saidova Gulnora', phone: '+998901110204', position: 'Bosh buxgalter', profile: 'good' },
  { top: 'moliya', fullName: 'Mirzayev Akmal', phone: '+998901110205', position: 'Iqtisodchi', profile: 'avg' },
  { top: 'logistika', fullName: 'Karimov Aziz', phone: '+998901110206', position: 'Omborchi (sklad mudiri)', profile: 'weak', stock: true },
  { top: 'logistika', fullName: 'Yusupov Sardor', phone: '+998901110207', position: 'Logist', profile: 'avg' },
  { top: 'logistika', fullName: 'Xolmatov Ulugbek', phone: '+998901110208', position: 'Haydovchilar brigadiri', profile: 'good' },
  { top: 'marketing', fullName: 'Abdullayeva Nilufar', phone: '+998901110209', position: 'SMM mutaxassisi', profile: 'avg' },
  { top: 'marketing', fullName: 'Ismoilov Farrux', phone: '+998901110210', position: 'Dizayner', profile: 'weak' },
];

const TASK_TITLES = {
  Savdo: [
    ['Yirik mijozlar bilan oylik shartnomalarni yangilash', "5 ta eng yirik ulgurji mijoz bilan yangi narxlar bo'yicha shartnoma imzolash"],
    ['Debitorlik qarzini undirish', "30 kundan oshgan qarzlar bo'yicha mijozlar bilan uchrashish va to'lov jadvalini kelishish"],
    ['Haftalik savdo rejasini tayyorlash', 'Har bir menejer kesimida reja va fakt jadvali'],
    ['Yangi hududda 10 ta do\'kon bilan aloqa o\'rnatish', "Yangi mijozlar bazasini kengaytirish, tijorat taklifini yuborish"],
    ['Narxlar ro\'yxatini yangilash', "Yangi tannarx asosida ulgurji va chakana narxlarni qayta hisoblash"],
    ['Qaytarilgan tovarlar sababini tahlil qilish', "Oxirgi oyda qaytarilgan tovarlar bo'yicha hisobot"],
  ],
  Moliya: [
    ['Oylik moliyaviy hisobotni tayyorlash', "Tushum, tannarx, xarajatlar va sof foyda bo'yicha hisobot"],
    ['Soliq hisobotlarini topshirish', "QQS va foyda solig'i deklaratsiyalarini o'z vaqtida topshirish"],
    ['Xarajatlar byudjetini qayta ko\'rib chiqish', "Keyingi chorak uchun bo'limlar kesimida byudjet"],
    ['Bank bilan kredit liniyasi shartlarini kelishish', 'Aylanma mablag\' uchun kredit liniyasi taklifini olish'],
    ['Kassa va bank qoldiqlarini solishtirish', 'Oy oxiri solishtirma dalolatnomasi'],
  ],
  Logistika: [
    ['Sklad inventarizatsiyasini o\'tkazish', "Asosiy skladdagi barcha tovarlarni sanab, Excel shaklida topshirish"],
    ['Yetkazib berish marshrutlarini optimallashtirish', "Yoqilg'i xarajatini 10% ga kamaytirish uchun marshrutlarni qayta tuzish"],
    ['Mashinalarga texnik ko\'rik o\'tkazish', "3 ta yuk mashinasini texnik ko'rikdan o'tkazish"],
    ['Yetkazib beruvchidan kelgan partiyani qabul qilish', 'Hujjatlar va miqdorni tekshirib, skladga kirim qilish'],
    ['Sklad hududini qayta tashkil etish', "Tez aylanadigan tovarlarni kirish yaqiniga joylashtirish"],
    ['Kechikkan yetkazib berishlar sababini aniqlash', "Oxirgi 2 haftadagi kechikishlar bo'yicha hisobot"],
  ],
  Marketing: [
    ['Instagram uchun oylik kontent-reja', '30 kunlik post va stories rejasi'],
    ['Aksiya uchun banner dizayni', "Do'konlar uchun 3 xil o'lchamdagi banner"],
    ['Raqobatchilar narxlarini o\'rganish', "5 ta asosiy raqobatchining narxlari bo'yicha jadval"],
    ['Reklama kampaniyasi natijalarini hisoblash', "Sarflangan byudjet va olingan mijozlar soni bo'yicha hisobot"],
    ['Yangi katalog tayyorlash', "Chop etish uchun mahsulotlar katalogi"],
  ],
  Rahbariyat: [
    ["Bo'lim bo'yicha choraklik strategiyani taqdim etish", "Keyingi chorak uchun maqsadlar va KPI'lar"],
    ['Xodimlar bilan individual suhbat o\'tkazish', "Har bir xodim bilan natijalar bo'yicha suhbat"],
    ['Bo\'lim xarajatlarini 5% ga qisqartirish rejasi', "Aniq chora-tadbirlar ro'yxati"],
  ],
};

const PROFILES = {
  good: { accept: [0.2, 2], ratio: [0.35, 0.9], fail: 0.03, quality: [4, 5], ret: 0.05, stuck: 0.05 },
  avg: { accept: [1.5, 9], ratio: [0.6, 1.2], fail: 0.08, quality: [3, 5], ret: 0.15, stuck: 0.15 },
  weak: { accept: [6, 36], ratio: [0.9, 1.9], fail: 0.18, quality: [2, 4], ret: 0.3, stuck: 0.3 },
};

const REASONS_BY_PROFILE = {
  good: ['BOSHQA_BOLIMGA_BOGLIQ', 'RESURS_YETMADI'],
  avg: ['VAQT_YETMADI', 'BOSHQA_BOLIMGA_BOGLIQ', 'RESURS_YETMADI', 'TOPSHIRIQ_NOANIQ'],
  weak: ['VAQT_YETMADI', 'TOPSHIRIQ_NOANIQ', 'VAQT_YETMADI', 'RESURS_YETMADI', 'BOSHQA'],
};

async function clearAll() {
  await prisma.aiReport.deleteMany();
  await prisma.tacticalDecision.deleteMany();
  await prisma.financeEntry.deleteMany();
  await prisma.strategyGoal.deleteMany();
  await prisma.stockCheckItem.deleteMany();
  await prisma.stockCheck.deleteMany();
  await prisma.taskFile.deleteMany();
  await prisma.taskHistory.deleteMany();
  await prisma.task.deleteMany();
  await prisma.employee.updateMany({ data: { managerId: null } });
  await prisma.employee.deleteMany();
  await prisma.company.deleteMany();
}

async function seedPeople() {
  await prisma.company.create({
    data: { name: 'Namuna Savdo MChJ', industry: 'Oziq-ovqat mahsulotlari ulgurji va chakana savdosi', currency: "so'm" },
  });
  const director = await prisma.employee.create({
    data: {
      ...DIRECTOR,
      phone: normalizePhone(DIRECTOR.phone),
      role: 'DIRECTOR',
      telegramId: config.directorTelegramId || null,
      isStockResponsible: true,
    },
  });
  const tops = {};
  for (const t of TOPS) {
    tops[t.key] = await prisma.employee.create({
      data: { fullName: t.fullName, phone: t.phone, position: t.position, department: t.department, role: 'TOP', managerId: director.id },
    });
    tops[t.key].profile = t.profile;
  }
  const middles = [];
  for (const m of MIDDLES) {
    const top = tops[m.top];
    const emp = await prisma.employee.create({
      data: {
        fullName: m.fullName,
        phone: m.phone,
        position: m.position,
        department: top.department,
        role: 'MIDDLE',
        managerId: top.id,
        isStockResponsible: Boolean(m.stock),
      },
    });
    emp.profile = m.profile;
    middles.push(emp);
  }
  return { director, tops: Object.values(tops), middles };
}

function buildTaskPlan(director, tops, middles) {
  const plan = [];
  for (let i = 0; i < 120; i += 1) {
    let assigner;
    let assignee;
    if (i % 4 === 0) {
      assigner = director;
      assignee = pick(tops);
    } else {
      assignee = pick(middles);
      assigner = tops.find((t) => t.id === assignee.managerId);
    }
    plan.push({ assigner, assignee });
  }
  return plan;
}

async function seedTasks(director, tops, middles) {
  const now = new Date();
  const plan = buildTaskPlan(director, tops, middles);
  let created = 0;

  for (let i = 0; i < plan.length; i += 1) {
    const { assigner, assignee } = plan[i];
    const profile = PROFILES[assignee.profile];
    const dept = assignee.role === 'TOP' ? 'Rahbariyat' : assignee.department;
    const [title, description] = pick(TASK_TITLES[dept]);

    // Oxirgi 3 oy bo'ylab tarqatilgan; oxirgi 10 ta — yaqin kunlardagi faol vazifalar
    const createdAt = i >= 110 ? new Date(now.getTime() - between(0.2, 4) * DAY_MS) : new Date(now.getTime() - between(3, 90) * DAY_MS);
    const durationDays = pick([1, 2, 3, 3, 5, 7, 7, 10]);
    let deadline = new Date(createdAt.getTime() + durationDays * DAY_MS);
    deadline = new Date(Math.round(deadline.getTime() / HOUR_MS) * HOUR_MS);
    const priority = pick(['PAST', 'ORTA', 'ORTA', 'YUQORI']);

    const history = [{ changedBy: assigner.id, oldStatus: null, newStatus: 'YANGI', comment: 'Vazifa yaratildi', createdAt }];
    const data = {
      title,
      description,
      assignerId: assigner.id,
      assigneeId: assignee.id,
      deadline,
      priority,
      status: 'YANGI',
      progress: 0,
      createdAt,
      returnCount: 0,
      remind24Sent: true,
      remind2Sent: true,
      overdueNotified: true,
    };

    const acceptAt = new Date(createdAt.getTime() + between(...profile.accept) * HOUR_MS);
    if (acceptAt < now) {
      data.acceptedAt = acceptAt;
      data.status = 'QABUL_QILINDI';
      history.push({ changedBy: assignee.id, oldStatus: 'YANGI', newStatus: 'QABUL_QILINDI', comment: 'Qabul qilindi', createdAt: acceptAt });
    }

    const planned = deadline.getTime() - createdAt.getTime();
    const completeAt = new Date(createdAt.getTime() + planned * between(...profile.ratio));
    const stuck = chance(profile.stuck) && deadline < now;
    const failed = chance(profile.fail) && deadline < now;

    if (data.acceptedAt && failed) {
      const failAt = new Date(Math.min(deadline.getTime() + between(0, 1) * DAY_MS, now.getTime() - HOUR_MS));
      data.status = 'BAJARILMADI';
      data.failReason = pick(REASONS_BY_PROFILE[assignee.profile]);
      data.failReasonText = data.failReason === 'BOSHQA' ? 'Mijoz tomonidan buyurtma bekor qilindi' : null;
      data.progress = pick([0, 25, 50]);
      history.push({ changedBy: assignee.id, oldStatus: 'QABUL_QILINDI', newStatus: 'BAJARILMADI', comment: data.failReasonText, createdAt: failAt });
    } else if (data.acceptedAt && (completeAt > now || stuck)) {
      // Hali bajarilmagan: jarayonda (muddati o'tgan bo'lishi mumkin)
      const progress = pick([25, 50, 75]);
      data.status = 'JARAYONDA';
      data.progress = progress;
      history.push({
        changedBy: assignee.id,
        oldStatus: 'QABUL_QILINDI',
        newStatus: 'JARAYONDA',
        comment: `Bajarilish: ${progress}%`,
        createdAt: new Date(Math.min(acceptAt.getTime() + between(2, 30) * HOUR_MS, now.getTime() - HOUR_MS)),
      });
      if (deadline < now) {
        data.failReason = pick(REASONS_BY_PROFILE[assignee.profile]);
        data.failReasonText = data.failReason === 'BOSHQA' ? "Boshqa shoshilinch ish chiqib qoldi" : null;
        history.push({ changedBy: assignee.id, oldStatus: 'JARAYONDA', newStatus: 'JARAYONDA', comment: 'Kechikish sababi', createdAt: new Date(deadline.getTime() + 2 * HOUR_MS) });
      } else {
        data.remind24Sent = false;
        data.remind2Sent = false;
        data.overdueNotified = false;
      }
    } else if (data.acceptedAt) {
      data.status = 'BAJARILDI';
      data.progress = 100;
      data.completedAt = completeAt;
      history.push({ changedBy: assignee.id, oldStatus: 'QABUL_QILINDI', newStatus: 'BAJARILDI', comment: completeAt > deadline ? 'Bajarildi (muddatidan kechikib)' : 'Bajarildi', createdAt: completeAt });

      if (chance(profile.ret)) {
        const returnAt = new Date(completeAt.getTime() + between(2, 20) * HOUR_MS);
        const redoneAt = new Date(returnAt.getTime() + between(0.5, 3) * DAY_MS);
        if (redoneAt < now) {
          data.returnCount = chance(0.25) ? 2 : 1;
          history.push({ changedBy: assigner.id, oldStatus: 'BAJARILDI', newStatus: 'QAYTARILDI', comment: pick(["Hisobotda raqamlar to'liq emas", 'Talabga javob bermaydi, qayta ishlang', "Dizayn tasdiqlangan brendbukga mos emas"]), createdAt: returnAt });
          history.push({ changedBy: assignee.id, oldStatus: 'QAYTARILDI', newStatus: 'BAJARILDI', comment: 'Qayta ishlab topshirildi', createdAt: redoneAt });
          data.completedAt = redoneAt;
        }
      }
      if (chance(0.85) && data.completedAt < new Date(now.getTime() - 6 * HOUR_MS)) {
        const [qMin, qMax] = profile.quality;
        data.qualityScore = Math.max(1, Math.min(5, intBetween(qMin, qMax) - (data.returnCount > 1 ? 1 : 0)));
        history.push({ changedBy: assigner.id, oldStatus: 'BAJARILDI', newStatus: 'BAJARILDI', comment: `Baho: ${'⭐'.repeat(data.qualityScore)}`, createdAt: new Date(data.completedAt.getTime() + 3 * HOUR_MS) });
      }
    } else {
      data.remind24Sent = deadline < now;
      data.remind2Sent = deadline < now;
    }

    await prisma.task.create({
      data: {
        ...data,
        history: { create: history.map((h) => ({ changedBy: h.changedBy, oldStatus: h.oldStatus, newStatus: h.newStatus, comment: h.comment, createdAt: h.createdAt })) },
      },
    });
    created += 1;
  }
  return created;
}

const PRODUCTS = [
  ['A-001', 'Shakar 1 kg', 14000], ['A-002', 'Un oliy nav 50 kg', 310000], ['A-003', "Kungaboqar yog'i 1 l", 21000],
  ['A-004', 'Guruch lazer 1 kg', 22000], ['A-005', 'Makaron 400 g', 7500], ['A-006', "Choy ko'k 100 g", 12000],
  ['A-007', 'Choy qora 250 g', 28000], ['A-008', 'Tuz 1 kg', 3500], ['A-009', "Tomat pastasi 800 g", 26000],
  ['A-010', "Sut quruq 400 g", 45000], ['A-011', 'Qahva 3in1 (paket)', 2500], ['A-012', 'Shokolad plitka 90 g', 16000],
  ['A-013', 'Pechenye 500 g', 19000], ['A-014', "Mol go'shti konserva", 38000], ['A-015', 'Baliq konserva', 24000],
  ['A-016', 'Mayonez 400 g', 15000], ['A-017', 'Ketchup 350 g', 13000], ['A-018', 'Asal 500 g', 65000],
  ['A-019', "Yong'oq 1 kg", 90000], ['A-020', 'Mosh 1 kg', 18000], ['A-021', "No'xat 1 kg", 17000],
  ['A-022', 'Loviya 1 kg', 20000], ['A-023', 'Grechka 1 kg', 21000], ['A-024', "Suli yormasi 1 kg", 16000],
  ['A-025', 'Mineral suv 1.5 l', 5000], ['A-026', 'Gazli ichimlik 1.5 l', 11000], ['A-027', 'Sharbat 1 l', 16000],
  ['A-028', 'Sovun 100 g', 6000], ['A-029', 'Kir yuvish kukuni 3 kg', 72000], ['A-030', 'Idish yuvish vositasi', 18000],
  ['A-031', "Tish pastasi", 17000], ['A-032', 'Shampun 400 ml', 42000], ['A-033', "Qog'oz sochiq", 14000],
  ['A-034', "Hojatxona qog'ozi (4 ta)", 16000], ['A-035', 'Tuxum (10 ta)', 17000], ['A-036', 'Sariyog\' 200 g', 30000],
  ['A-037', 'Pishloq 1 kg', 95000], ['A-038', 'Kolbasa 1 kg', 85000], ['A-039', 'Muzqaymoq (quti)', 48000],
  ['A-040', 'Ziravorlar to\'plami', 9000],
];

/* Ikkala sverkada ham farq chiqadigan tovarlar (takrorlanuvchi farqlar) */
const REPEATING = ['A-003', 'A-012', 'A-018', 'A-019', 'A-037'];

async function seedStock() {
  const now = new Date();
  const checks = [
    { daysAgo: 62, warehouse: 'Asosiy sklad', diffChance: 0.15 },
    { daysAgo: 12, warehouse: 'Asosiy sklad', diffChance: 0.12 },
  ];
  for (const c of checks) {
    const checkDate = new Date(now.getTime() - c.daysAgo * DAY_MS);
    const items = PRODUCTS.map(([code, name, price]) => {
      const systemQty = intBetween(20, 400);
      let diffQty = 0;
      const responsible = code >= 'A-028' && code <= 'A-034' ? 'Yusupov Sardor' : 'Karimov Aziz';
      if (REPEATING.includes(code)) diffQty = -intBetween(3, 15);
      else if (chance(c.diffChance)) diffQty = chance(0.7) ? -intBetween(1, 8) : intBetween(1, 5);
      const actualQty = systemQty + diffQty;
      return { code, name, systemQty, actualQty, price, diffQty, diffSum: diffQty * price, responsible };
    });
    const shortage = items.filter((i) => i.diffSum < 0).reduce((s, i) => s + i.diffSum, 0);
    const surplus = items.filter((i) => i.diffSum > 0).reduce((s, i) => s + i.diffSum, 0);
    await prisma.stockCheck.create({
      data: {
        checkDate,
        warehouse: c.warehouse,
        responsible: 'Karimov Aziz',
        fileName: `sverka_${checkDate.toISOString().slice(0, 10)}.xlsx`,
        totalDiff: shortage + surplus,
        shortageSum: shortage,
        surplusSum: surplus,
        itemCount: items.length,
        items: { create: items },
      },
    });
  }
}

async function seedFinance() {
  const current = monthKey(new Date());
  const months = [];
  for (let i = 6; i >= 1; i -= 1) months.push(shiftMonth(current, -i));

  // 0..5 indeksli oylar. 2-oyda marketing byudjeti oshirildi, 2-oyda yetkazib beruvchi bilan chegirma, 3-oyda qo'shimcha xodimlar.
  const revenueFact = [1850, 1890, 1920, 2060, 2150, 2230].map((v) => v * 1e6);
  const revenuePlan = [1900, 1950, 2000, 2050, 2150, 2250].map((v) => v * 1e6);
  const cogsShare = [0.735, 0.738, 0.736, 0.712, 0.708, 0.705];
  const expenses = {
    'Ish haqi': [168, 170, 171, 196, 199, 201],
    Ijara: [45, 45, 45, 45, 45, 48],
    Marketing: [52, 55, 58, 76, 78, 80],
    Logistika: [58, 60, 61, 63, 66, 70],
    Kommunal: [14, 15, 13, 12, 12, 14],
    Boshqa: [18, 21, 17, 20, 19, 22],
  };
  const expensePlan = {
    'Ish haqi': [170, 170, 170, 190, 190, 190],
    Ijara: [45, 45, 45, 45, 45, 45],
    Marketing: [50, 50, 55, 75, 75, 75],
    Logistika: [58, 58, 60, 60, 62, 62],
    Kommunal: [15, 15, 14, 14, 14, 14],
    Boshqa: [18, 18, 18, 18, 18, 18],
  };

  const rows = [];
  months.forEach((month, i) => {
    const wholesaleShare = 0.62;
    rows.push({ month, type: 'TUSHUM', category: 'Ulgurji savdo', planAmount: Math.round(revenuePlan[i] * wholesaleShare), factAmount: Math.round(revenueFact[i] * wholesaleShare) });
    rows.push({ month, type: 'TUSHUM', category: 'Chakana savdo', planAmount: Math.round(revenuePlan[i] * (1 - wholesaleShare)), factAmount: Math.round(revenueFact[i] * (1 - wholesaleShare)) });
    rows.push({ month, type: 'TANNARX', category: 'Tovar tannarxi', planAmount: Math.round(revenuePlan[i] * 0.72), factAmount: Math.round(revenueFact[i] * cogsShare[i]) });
    for (const [category, values] of Object.entries(expenses)) {
      rows.push({ month, type: 'XARAJAT', category, planAmount: expensePlan[category][i] * 1e6, factAmount: values[i] * 1e6 });
    }
  });
  // Joriy oy uchun faqat reja
  rows.push({ month: current, type: 'TUSHUM', category: 'Ulgurji savdo', planAmount: Math.round(2300e6 * 0.62), factAmount: 0 });
  rows.push({ month: current, type: 'TUSHUM', category: 'Chakana savdo', planAmount: Math.round(2300e6 * 0.38), factAmount: 0 });
  rows.push({ month: current, type: 'TANNARX', category: 'Tovar tannarxi', planAmount: Math.round(2300e6 * 0.71), factAmount: 0 });
  for (const [category, values] of Object.entries(expensePlan)) {
    rows.push({ month: current, type: 'XARAJAT', category, planAmount: values[5] * 1e6, factAmount: 0 });
  }
  await prisma.financeEntry.createMany({ data: rows });

  await prisma.strategyGoal.createMany({
    data: [
      { name: 'Sof foyda marjasini 12% dan yuqori ushlab turish', metric: 'SOF_MARJA', condition: 'GTE', targetValue: 12, period: '2026-yil' },
      { name: "Tushumni har oy kamida 3% o'stirish", metric: 'TUSHUM_OSISHI', condition: 'GTE', targetValue: 3, period: '2026-yil' },
      { name: "Operatsion xarajatlar tushumning 17% idan oshmasin", metric: 'XARAJAT_ULUSHI', condition: 'LTE', targetValue: 17, period: '2026-yil' },
      { name: 'Marketing xarajati tushumning 3,5% idan oshmasin', metric: 'TOIFA_ULUSHI', category: 'Marketing', condition: 'LTE', targetValue: 3.5, period: '2026-yil' },
      { name: 'Savdo rejasini kamida 97% bajarish', metric: 'REJA_BAJARILISHI', condition: 'GTE', targetValue: 97, period: '2026-yil' },
    ],
  });

  const [y0, m0] = months[3].split('-').map(Number);
  const [y2, m2] = months[5].split('-').map(Number);
  const [yPrev, mPrev] = months[2].split('-').map(Number);
  await prisma.tacticalDecision.createMany({
    data: [
      {
        date: tashkentDate(yPrev, mPrev, 25),
        title: 'Marketing byudjetini 30% ga oshirish',
        description: 'Instagram va Telegram reklamasiga qo\'shimcha mablag\' ajratildi, yangi hududlarda aksiya o\'tkazildi.',
        metric: 'TUSHUM_OSISHI',
        expectedResult: "Tushumning oylik o'sishi kamida 4%",
      },
      {
        date: tashkentDate(yPrev, mPrev, 28),
        title: 'Asosiy yetkazib beruvchi bilan 3% chegirma kelishuvi',
        description: "Katta hajmdagi oldindan to'lov evaziga xarid narxi kamaytirildi.",
        metric: 'TANNARX_ULUSHI',
        expectedResult: 'Tannarx ulushi 72% dan pastga tushadi',
      },
      {
        date: tashkentDate(y0, m0, 5),
        title: "Kechki smena uchun 4 ta qo'shimcha sotuvchi",
        description: 'Chakana savdoni kechki soatlarda oshirish uchun xodimlar qabul qilindi.',
        metric: 'XARAJAT_ULUSHI',
        expectedResult: "Xarajatlar ulushi o'zgarmagan holda chakana savdo o'sishi",
      },
      {
        date: tashkentDate(y2, m2, 10),
        title: 'Logistikani qisman autsorsingga berish',
        description: "Uzoq hududlarga yetkazib berish tashqi kompaniyaga topshirildi.",
        metric: 'TOIFA_ULUSHI',
        category: 'Logistika',
        expectedResult: 'Logistika xarajati ulushi 3% dan pastga tushadi',
      },
    ],
  });
}

async function main() {
  console.log("🧹 Eski ma'lumotlar tozalanmoqda...");
  await clearAll();
  console.log('👥 Xodimlar yaratilmoqda...');
  const { director, tops, middles } = await seedPeople();
  console.log('📋 Vazifalar yaratilmoqda...');
  const count = await seedTasks(director, tops, middles);
  console.log('📦 Sklad sverkalari yaratilmoqda...');
  await seedStock();
  console.log("💰 Moliya, maqsadlar va qarorlar yaratilmoqda...");
  await seedFinance();
  console.log(`\n✅ Tayyor: 1 kompaniya, ${1 + tops.length + middles.length} xodim, ${count} vazifa, 2 sverka, 5 maqsad, 6 oylik moliya, 4 qaror.`);
  console.log(`   Direktor: ${director.fullName} (Telegram ID: ${director.telegramId || "ko'rsatilmagan"})`);
}

main()
  .catch((error) => {
    console.error('❌ Seed xatosi:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
