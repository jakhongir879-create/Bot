# 📊 Biznes Dashboard Bot

Biznesingizning barcha hisobotlarini ko'rsatadigan **Telegram bot** va **Web Dashboard**. Hammasi o'zbek tilida va to'liq kompyuteringizda (localhost) ishlaydi.

## Nimalar bor

**🤖 Telegram bot**
- 📊 Bugungi, haftalik va oylik hisobot: tushum, tannarx, yalpi va sof foyda, xarajatlar, o'rtacha chek, to'lov turlari, oldingi davrga nisbatan % o'zgarish
- 📈 7 va 30 kunlik grafik
- 🏆 Eng ko'p sotilgan mahsulotlar
- ➕ Botning o'zidan sotuv kiritish (savat, miqdor, naqd/karta/o'tkazma/nasiya)
- ➖ Xarajat kiritish (ijara, ish haqi, kommunal va h.k.)
- 📦 Ombor qoldig'i va kam qolgan mahsulotlar
- 💳 Qarzdor mijozlar ro'yxati
- 📥 Excel hisobot (6 ta varaq)
- ⏰ Avtomatik hisobotlar: har kuni kechqurun, har dushanba (haftalik), har oyning 1-kuni (oylik)
- 🔐 Faqat ruxsat berilgan xodimlar foydalana oladi (Egasi / Menejer)

**🌐 Web Dashboard** (brauzerda va Telegram Mini App sifatida ochiladi)
- Bosh sahifa: 8 ta asosiy ko'rsatkich, grafiklar, top mahsulotlar, xarajatlar tarkibi, savdo eng ko'p bo'ladigan soatlar
- Sotuvlar, Xarajatlar, Mahsulotlar/Ombor, Mijozlar, Qarzdorlik sahifalari: qo'shish, tahrirlash, o'chirish
- Hisobotlar: foyda va zarar hisoboti, kunlar va mahsulotlar kesimida, Excel yuklab olish
- Sozlamalar: botga xodim qo'shish/o'chirish

---

## ⚡ Eng oson yo'l (Windows)

1. Node.js o'rnating: https://nodejs.org (LTS).
2. Neon manzili, BotFather tokeni va Telegram ID ni tayyorlang (2–4-qadamlar).
3. **`ISHGA-TUSHIRISH.bat`** faylini ikki marta bosing.
4. Notepad ochiladi. Ma'lumotlarni yozing, saqlang va yoping. Qolganini fayl o'zi bajaradi va dashboardni brauzerda ochadi.

Keyingi safar ham shu faylni ikki marta bosish yetarli.

---

## 1-QADAM. Kerakli dasturlar

1. **Node.js** (20-versiya yoki undan yangi): https://nodejs.org → "LTS" ni yuklab o'rnating.
2. **ngrok**: https://ngrok.com/download (Mini App uchun, 7-qadamda kerak bo'ladi).

Terminalda tekshirib ko'ring:
```bash
node -v
npm -v
```

## 2-QADAM. Neon'da ma'lumotlar bazasini yaratish

1. https://neon.tech saytiga kiring va **Sign up** tugmasini bosing (Google akkaunt bilan kirsangiz bo'ladi).
2. **Create project** tugmasini bosing. Nomini yozing (masalan `biznes`), Region sifatida **Europe (Frankfurt)** ni tanlang va **Create** ni bosing.
3. Ochilgan oynada **Connect** tugmasini bosing.
4. **Connection pooling** tugmachasini **o'chiring**.
5. `postgresql://...` bilan boshlanadigan manzilni nusxalang. Bu sizning **DATABASE_URL** manzilingiz.

## 3-QADAM. BotFather orqali bot yaratish

1. Telegram'da **@BotFather** ni qidirib toping (nomi yonida ko'k belgi bo'lishi kerak).
2. **Start** ni bosing, keyin `/newbot` deb yozing.
3. Bot uchun nom yozing, masalan: `Mening Biznes Hisobotim`
4. Bot uchun username yozing. U **bot** so'zi bilan tugashi shart, masalan: `mening_biznes_hisobot_bot`
5. BotFather `1234567890:AAH...` ko'rinishidagi **token** beradi. Uni nusxalang. Bu sizning **BOT_TOKEN** ingiz.

   ⚠️ Tokenni hech kimga bermang.

## 4-QADAM. O'z Telegram ID raqamingizni bilish

1. Telegram'da **@userinfobot** ni oching va **Start** ni bosing.
2. U ko'rsatgan `Id: 123456789` raqamni nusxalang. Bu sizning **OWNER_IDS** qiymatingiz.

## 5-QADAM. Sozlamalar faylini to'ldirish

Terminalni loyiha papkasida oching va quyidagini yozing:

```bash
# Windows (PowerShell):
copy backend\.env.example backend\.env
# Mac / Linux:
cp backend/.env.example backend/.env
```

`backend/.env` faylini istalgan matn muharririda (Notepad, VS Code) oching va to'ldiring:

```env
DATABASE_URL="Neon bergan manzil"
BOT_TOKEN="BotFather bergan token"
OWNER_IDS="sizning Telegram ID"
ADMIN_PASSWORD="dashboard uchun o'zingiz o'ylab topgan parol"
JWT_SECRET="istalgan uzun tasodifiy matn, masalan: aK9x2mQ7pL0vB3nZ8"
BUSINESS_NAME="Biznesingiz nomi"
DAILY_REPORT_TIME="21:00"
```

## 6-QADAM. O'rnatish va ishga tushirish

Terminalda loyiha papkasida ketma-ket yozing:

```bash
# 1) Paketlarni o'rnatish
npm run install:all

# 2) Bazada jadvallarni yaratish va namuna ma'lumotlarni yozish
npm run db:setup

# 3) Dashboardni tayyorlash (build)
npm run build

# 4) Bot va Dashboardni ishga tushirish
npm start
```

Terminalda quyidagilar chiqsa, hammasi ishlayapti:
```
✅ Maʼlumotlar bazasiga ulandi
🌐 Dashboard va API: http://localhost:4000
🤖 Bot ishga tushdi: @sizning_botingiz
```

- **Dashboard**: brauzerda http://localhost:4000 ni oching va `.env` dagi `ADMIN_PASSWORD` bilan kiring.
- **Bot**: Telegram'da botingizni oching va `/start` deb yozing.

> 💡 Namuna ma'lumotlar (11 ta mahsulot, so'nggi 60 kunlik sotuvlar) faqat dashboard qanday ishlashini ko'rsatish uchun qo'shiladi. Ularni tozalab, o'z ma'lumotlaringizdan boshlash uchun:
> ```bash
> cd backend
> npx prisma migrate reset --skip-seed
> ```

Keyingi safar ishga tushirish uchun faqat `npm start` yozish yetarli.

## 7-QADAM. ngrok orqali Dashboard'ni Telegram ichida ochish (Mini App)

Telegram Mini App faqat `https://` manzil bilan ishlaydi. ngrok kompyuteringizdagi `localhost:4000` ga vaqtinchalik `https` manzil beradi.

1. https://dashboard.ngrok.com/signup saytidan ro'yxatdan o'ting.
2. **Your Authtoken** bo'limidagi buyruqni nusxalab, terminalda bir marta ishga tushiring:
   ```bash
   ngrok config add-authtoken SIZNING_NGROK_TOKENINGIZ
   ```
3. `npm start` ishlab turgan holda **yangi terminal oynasi** oching va yozing:
   ```bash
   ngrok http 4000
   ```
4. ngrok `Forwarding  https://abcd-1234.ngrok-free.app -> http://localhost:4000` ko'rinishidagi qator chiqaradi. `https://...` manzilni nusxalang.
5. `backend/.env` faylida uni yozing:
   ```env
   WEBAPP_URL="https://abcd-1234.ngrok-free.app"
   ```
6. Birinchi terminalda serverni to'xtating (`Ctrl + C`) va qayta ishga tushiring: `npm start`
7. Telegram'da botni oching:
   - chap pastda **Dashboard** menyu tugmasi paydo bo'ladi, yoki
   - **🌐 Dashboard** tugmasini bosing.

   Dashboard Telegram ichida ochiladi va parolsiz, Telegram akkauntingiz orqali avtomatik kiradi.

   Birinchi ochishda ngrok ogohlantirish sahifasi chiqishi mumkin. Unda **Visit Site** tugmasini bosing.

> ⚠️ ngrok'ning bepul versiyasida har safar `ngrok http 4000` ni qayta ishga tushirganingizda manzil o'zgaradi. Shunda 5- va 6-qadamlarni takrorlang. Doimiy manzil olish uchun ngrok saytidagi **Domains** bo'limidan bitta bepul domen oling va `ngrok http --url=sizning-domeningiz.ngrok-free.app 4000` deb ishga tushiring.

> ℹ️ Kunlik avtomatik hisobot faqat kompyuter yoqiq va `npm start` ishlab turgan paytda yuboriladi.

---

## Xodim qo'shish

1. Xodim botga `/id` deb yozadi va chiqqan raqamni sizga yuboradi.
2. Siz uni ikki usulning biri bilan qo'shasiz:
   - Dashboard → **Sozlamalar** → Xodim qo'shish
   - yoki botda: `/addadmin 123456789 Ism`

**Menejer** hisobotlarni ko'ra oladi, sotuv va xarajat kirita oladi. **Egasi** bunga qo'shimcha ravishda xodimlarni boshqaradi.

## Botdagi tugmalar

| Tugma | Vazifasi |
|---|---|
| 📊 Bugun / 📅 Hafta / 🗓 Oy | Hisobot (ostidagi tugmalar bilan davrni almashtirish mumkin) |
| 📈 Grafik | So'nggi 7 (yoki 30) kunlik tushum grafigi |
| 🏆 Top mahsulotlar | Eng ko'p daromad keltirgan mahsulotlar |
| ➕ Sotuv | Yangi sotuv kiritish |
| ➖ Xarajat | Yangi xarajat kiritish |
| 📦 Ombor | Qoldiqlar va ombor qiymati |
| 💳 Qarzdorlar | Nasiya olgan mijozlar |
| 📥 Excel hisobot | Tanlangan davr uchun .xlsx fayl |
| 🌐 Dashboard | To'liq web-dashboardni ochish |

## Dasturlash rejimi (ixtiyoriy)

Kod ustida ishlayotganda o'zgarishlar darhol ko'rinishi uchun ikkita terminalda:
```bash
npm run dev:backend      # API + bot (http://localhost:4000)
npm run dev:dashboard    # Dashboard (http://localhost:5173)
```

## Loyiha tuzilishi

```
├── backend/                  # Node.js: Telegram bot + API
│   ├── prisma/
│   │   ├── schema.prisma     # Jadvallar: Admin, Category, Product, Customer, Sale, SaleItem, Expense
│   │   ├── migrations/
│   │   └── seed.js           # Namuna ma'lumotlar
│   └── src/
│       ├── config/default.js
│       ├── core/bot.js
│       ├── database/connection.js
│       ├── models/           # Admin, Category, Product, Customer, Sale, Expense
│       ├── services/         # hisobotlar, Excel, avtomatik hisobot, bildirishnomalar
│       ├── controllers/      # bot, auth, hisobot, admin CRUD
│       ├── routes/           # bot.routes, auth.routes, admin.routes
│       ├── middlewares/      # auth (JWT), xatolar
│       ├── utils/
│       └── index.js
└── dashboard/                # React + Vite + Recharts
    └── src/pages/            # Bosh sahifa, Sotuvlar, Xarajatlar, Mahsulotlar, Mijozlar, Qarzdorlik, Hisobotlar, Sozlamalar
```

## Muammolar va yechimlar

| Xato | Yechim |
|---|---|
| `Can't reach database server` | `DATABASE_URL` ni tekshiring. Oxirida `?sslmode=require` bo'lishi kerak. |
| `Bot ishga tushmadi (BOT_TOKEN ni tekshiring)` | Tokenni BotFather'dan qayta nusxalang, bo'sh joy qolmasin. |
| Bot "ruxsat yo'q" deydi | `OWNER_IDS` ga o'z ID ingizni yozing (`/id` buyrug'i bilan bilib olasiz) va serverni qayta ishga tushiring. |
| Dashboard "build qilinmagan" deydi | `npm run build` ni ishga tushiring. |
| Mini App "Ruxsat yo'q" deydi | Telegram akkauntingiz Sozlamalar ro'yxatida faol ekanini tekshiring. |
| `Port 4000 is already in use` | `.env` da `PORT=4001` qiling va ngrok'ni ham `ngrok http 4001` bilan ishga tushiring. |
