require('dotenv').config();

const list = (v) =>
  String(v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const config = {
  port: Number(process.env.PORT) || 4000,
  botToken: process.env.BOT_TOKEN || '',
  ownerIds: list(process.env.OWNER_IDS),
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  jwtSecret: process.env.JWT_SECRET || 'change-me-secret',
  webAppUrl: (process.env.WEBAPP_URL || '').replace(/\/+$/, ''),
  dailyReportTime: process.env.DAILY_REPORT_TIME || '21:00',
  businessName: process.env.BUSINESS_NAME || 'Mening biznesim',
  notifyNewSales: String(process.env.NOTIFY_NEW_SALES).toLowerCase() === 'true',
  timezone: 'Asia/Tashkent',
  // Toshkent UTC+5 (yozgi vaqt yo'q)
  tzOffsetHours: 5,

  paymentMethods: {
    CASH: 'Naqd',
    CARD: 'Karta',
    TRANSFER: "O'tkazma",
    DEBT: 'Nasiya',
  },

  expenseCategories: [
    'Ijara',
    'Ish haqi',
    'Kommunal',
    'Xomashyo',
    'Reklama',
    'Transport',
    'Soliq',
    'Boshqa',
  ],
};

module.exports = config;
