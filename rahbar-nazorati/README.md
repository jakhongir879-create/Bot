# 📊 Rahbar nazorati va moliyaviy tahlil tizimi

Tizim uch qismdan iborat va to'liq sizning kompyuteringizda (localhost) ishlaydi:

- **🤖 Telegram bot:** vazifa berish, eslatmalar, baholash, Excel orqali sklad sverkasi, direktor uchun AI savol-javob.
- **📱 Telegram Mini App:** xodimlar uchun ilova (vazifalar, jamoa, profil, faollik bali).
- **🌐 Web Dashboard:** direktor paneli (KPI, vazifalar, xodimlar faolligi, sklad, moliya va strategiya, AI hisobotlar).

Har bir bo'limdagi AI tahlil doim uch qismdan iborat: **📊 Tahlil → 💡 Xulosa → ✅ Tavsiyalar**.

---

## ⚡ Eng oson yo'l (Windows)

1. Node.js o'rnating (1-qadam).
2. `rahbar-nazorati` papkasidagi **`ishga-tushirish.bat`** faylini ikki marta bosing.
3. Notepad ochiladi. `.env` ni to'ldiring (3-qadam), saqlang va qora oynaga qaytib istalgan tugmani bosing.

Qolgan ishlarni fayl o'zi bajaradi va Dashboard'ni brauzerda ochadi. Keyingi safar ham shu faylni ikki marta bosish yetarli.

---

## 1-qadam. Kerakli dasturlar

1. **Node.js** (20 yoki undan yangi versiya): https://nodejs.org → **LTS** tugmasini bosib yuklab oling va o'rnating (hamma joyda "Next" ni bosing). Keyin kompyuterni qayta yoqing.
2. **ngrok**: https://ngrok.com saytida ro'yxatdan o'ting → **Download** → Windows uchun yuklab oling. ZIP ichidagi `ngrok.exe` ni `rahbar-nazorati` papkasiga ko'chiring.
3. ngrok saytida chap menyudan **Your Authtoken** bo'limini oching va u yerdagi buyruqni nusxalang. Terminalda (`rahbar-nazorati` papkasida) ishga tushiring:
   ```
   ngrok config add-authtoken SIZNING_TOKENINGIZ
   ```

Tekshirish uchun terminalda quyidagilarni yozing:
```
node -v
npm -v
```

> **Terminalni qanday ochish kerak:** `rahbar-nazorati` papkasini oching, yuqoridagi manzil qatoriga `cmd` deb yozing va **Enter** ni bosing.

## 2-qadam. Paketlarni o'rnatish

```
npm run setup
```

## 3-qadam. `.env` faylini to'ldirish

`.env.example` faylidan nusxa olib, nusxaning nomini `.env` qiling:
```
copy .env.example .env
notepad .env
```
Ichidagi qiymatlarni to'ldiring, so'ng **Ctrl+S** bilan saqlang.

## 4-qadam. Ma'lumotlar bazasi

```
npx prisma migrate deploy
npm run db:seed
```
Birinchi buyruq jadvallarni yaratadi. Ikkinchisi demo ma'lumotlarni yozadi: "Namuna Savdo MChJ", 15 ta xodim, 120 ta vazifa, 2 ta sverka, 6 oylik moliya.

⚠️ `npm run db:seed` bazani **tozalab**, demo ma'lumotni qaytadan yozadi. Uni haqiqiy ish boshlangandan keyin ishga tushirmang.

## 5-qadam. Ishga tushirish

```
npm run build
npm start
```
- 🌐 Dashboard: **http://localhost:3000/dashboard**
- Bot avtomatik ishlaydi. Terminal oynasini yopmang.

## 6-qadam. Mini App uchun ngrok

1. **Ikkinchi** terminal oynasini oching (`rahbar-nazorati` papkasida) va yozing:
   ```
   ngrok http 3000
   ```
2. `Forwarding` qatoridagi `https://....ngrok-free.app` manzilini nusxalang.
3. `.env` faylidagi `WEBAPP_URL` ga shu manzilni yozing. Oxirida `/` belgisi bo'lmasin:
   ```
   WEBAPP_URL="https://abcd-1234.ngrok-free.app"
   ```
4. Birinchi terminalda **Ctrl+C** bosing, keyin qayta `npm start` yozing. Bot "Ilova" tugmasini o'zi ulaydi.

**Qo'lda ulash (ixtiyoriy):** @BotFather → `/mybots` → botingiz → **Bot Settings** → **Menu Button** → **Configure menu button** → `https://....ngrok-free.app/app/` manzilini yuboring → nomi: `Ilova`.

> Mini App'ni birinchi marta ochganda ngrok ogohlantirish sahifasi chiqishi mumkin. **Visit Site** tugmasini bir marta bosing.

## ✅ Tekshirish ro'yxati

1. Botga `/start` yozing. Direktor sifatida menyu chiqishi kerak.
2. **➕ Vazifa berish** orqali xodimni tanlang, sarlavha, deadline va muhimlikni kiriting. Vazifa yaratiladi.
3. Botga Excel fayl yuboring (shablonni Dashboard → Sklad sverka → "Namunaviy shablon" dan olasiz). Qisqa natija keladi.
4. http://localhost:3000/dashboard manziliga login va parol bilan kiring.
5. Istalgan bo'limda **🤖 AI tahlil** tugmasini bosing (API kalit kerak).
6. Botdagi **📱 Ilovani ochish** tugmasini bosing. Mini App ochilishi kerak.

## ☁️ Serverga joylash (Railway, 24/7)

1. https://railway.com → GitHub bilan kiring → **New Project** → **Deploy from GitHub repo** → `Bot` repozitoriysi.
2. Servis → **Settings** → **Source** → **Branch**: `claude/intelligent-euler-95kz1s`.
3. **Variables** → **Raw Editor** → `.env` dagi qatorlarni joylashtiring va qo'shing: `DASHBOARD_PUBLIC="true"`.
4. **Settings** → **Networking** → **Generate Domain** → manzilni `WEBAPP_URL` ga yozing.
5. Kompyuterdagi botni to'xtating (bitta bot faqat bir joyda ishlashi mumkin).

Dashboard: `https://SIZNING-MANZIL.up.railway.app/dashboard`. Serverda Dashboard internetga ochiq bo'ladi — kuchli parol qo'ying.

## Xodimlarni ulash

Dashboard → **Xodimlar** bo'limida xodim qo'shing (telefon raqami bilan). Xodim botga `/start` yozib, **📞 Kontaktni yuborish** tugmasini bosadi va tizimga ulanadi.

## AI kalitini keyinroq qo'shish

`.env` fayliga `ANTHROPIC_API_KEY="sk-ant-..."` ni yozing va backend'ni qayta ishga tushiring (**Ctrl+C**, keyin `npm start`).

## Foydali buyruqlar

| Buyruq | Nima qiladi |
|---|---|
| `npm start` | Tizimni ishga tushiradi |
| `npm run build` | Mini App va Dashboard'ni qayta tayyorlaydi |
| `npm run db:seed` | Demo ma'lumotni qaytadan yozadi (bazani tozalaydi!) |
| `npx prisma studio` | Bazani brauzerda ko'rish |

## Xavfsizlik

- Mini App har bir so'rovda Telegram imzosini (initData) BOT_TOKEN orqali tekshiradi.
- Middle manager faqat o'z vazifalarini ko'radi. Top manager o'zinikini va bo'ysunuvchilarinikini ko'radi, direktor esa hammasini ko'radi.
- Dashboard JWT bilan himoyalangan. U **faqat shu kompyuterda** ochiladi, ngrok orqali tashqaridan ochib bo'lmaydi.
- Yuklangan Excel fayllar formati (.xlsx, .xls, .csv) va hajmi (20 MB gacha) tekshiriladi.
- `.env` fayli GitHub'ga yuklanmaydi. Uni hech kimga bermang.

> `npm install` vaqtida `xlsx` paketi haqida ogohlantirish chiqishi mumkin. Excel faylni faqat tizimga kirgan direktor yoki sklad mas'uli yuklay oladi, shuning uchun bu localhost ishlatish uchun xavfli emas.
