@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Biznes Dashboard Bot

where node >nul 2>nul
if errorlevel 1 goto :nonode

if not exist "backend\package.json" goto :wrongdir

if not exist "backend\.env" (
  copy "backend\.env.example" "backend\.env" >nul
  echo.
  echo ============================================================
  echo  Hozir Notepad ochiladi. Quyidagilarni to'ldiring:
  echo    DATABASE_URL   - Neon bergan manzil
  echo    BOT_TOKEN      - BotFather bergan token
  echo    OWNER_IDS      - @userinfobot bergan ID raqam
  echo    ADMIN_PASSWORD - dashboard uchun parol
  echo  Keyin Ctrl+S bilan saqlang.
  echo ============================================================
  echo.
  start "" notepad "backend\.env"
  echo  Saqlab bo'lgach, SHU qora oynaga qaytib, istalgan tugmani bosing...
  pause >nul
)

:checkenv
findstr /c:"ep-xxxx" "backend\.env" >nul
if errorlevel 1 goto :envok
echo.
echo [!] Sozlamalar hali to'ldirilmagan. Notepad yana ochiladi.
echo     To'ldiring, Ctrl+S bilan saqlang va shu oynada istalgan tugmani bosing...
start "" notepad "backend\.env"
pause >nul
goto :checkenv
:envok

if not exist "backend\node_modules" (
  echo.
  echo [1/3] Paketlar o'rnatilmoqda, bir necha daqiqa kuting...
  call npm run install:all
  if errorlevel 1 goto :err
)

if not exist "backend\.setup-done" (
  echo.
  echo [2/3] Ma'lumotlar bazasi tayyorlanmoqda...
  call npm run db:setup
  if errorlevel 1 goto :err
  echo ok> "backend\.setup-done"
)

if not exist "dashboard\dist" (
  echo.
  echo [3/3] Dashboard tayyorlanmoqda...
  call npm run build
  if errorlevel 1 goto :err
)

echo.
echo ============================================================
echo  Ishga tushdi! Bu oynani YOPMANG - yopilsa bot to'xtaydi.
echo  Dashboard: http://localhost:4000
echo ============================================================
echo.
start "" cmd /c "timeout /t 8 >nul & start http://localhost:4000"
call npm start
pause
exit /b

:nonode
echo.
echo [XATO] Node.js topilmadi. https://nodejs.org dan LTS versiyani o'rnating
echo va kompyuterni qayta yoqing.
pause
exit /b

:wrongdir
echo.
echo [XATO] Bu fayl noto'g'ri joyda turibdi.
echo Uni ZIP'dan ochilgan papka ichidan ishga tushiring:
echo o'sha papkada backend va dashboard papkalari bo'lishi kerak.
pause
exit /b

:err
echo.
echo [XATO] Nimadir ishlamadi. Shu oynaning rasmini olib yuboring.
pause
exit /b
