@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Rahbar nazorati

where node >nul 2>nul
if errorlevel 1 (
  echo [XATO] Node.js topilmadi. https://nodejs.org dan LTS versiyani o'rnating va kompyuterni qayta yoqing.
  pause
  exit /b
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo.
  echo  .env fayli yaratildi va Notepad'da ochiladi.
  echo  Ma'lumotlarni to'ldiring, Ctrl+S bilan saqlang, keyin shu oynaga qaytib istalgan tugmani bosing.
  start "" notepad ".env"
  pause >nul
)

if not exist "node_modules" (
  echo.
  echo [1/4] Paketlar o'rnatilmoqda, bir necha daqiqa kuting...
  call npm run setup
  if errorlevel 1 goto :err
)

if not exist ".db-ready" (
  echo.
  echo [2/4] Ma'lumotlar bazasi jadvallari yaratilmoqda...
  call npx prisma migrate deploy
  if errorlevel 1 goto :err
  echo.
  echo [3/4] Namunaviy ma'lumotlar yozilmoqda...
  call npm run db:seed
  if errorlevel 1 goto :err
  echo ok> ".db-ready"
)

if not exist "dashboard\dist\index.html" (
  echo.
  echo [4/4] Mini App va Dashboard tayyorlanmoqda...
  call npm run build
  if errorlevel 1 goto :err
)

echo.
echo ============================================================
echo  Tizim ishga tushdi! Bu oynani YOPMANG.
echo  Web Dashboard: http://localhost:3000/dashboard
echo ============================================================
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3000/dashboard"
call npm start
pause
exit /b

:err
echo.
echo [XATO] Nimadir ishlamadi. Shu oynaning rasmini olib yuboring.
pause
exit /b
