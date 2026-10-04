#!/usr/bin/env bash
# Rahbar nazorati — DigitalOcean (Ubuntu/Debian) serveriga avtomatik o'rnatish.
# Qayta ishga tushirish xavfsiz: kodni yangilaydi, sozlamalarni saqlaydi.
set -euo pipefail

REPO="https://github.com/jakhongir879-create/Bot.git"
BRANCH="claude/intelligent-euler-95kz1s"
DIR="/opt/rahbar"
APP="$DIR/rahbar-nazorati"
ENV_FILE="$APP/.env"

log() { echo -e "\n\033[1;34m==> $*\033[0m"; }
warn() { echo -e "\033[1;33m[!] $*\033[0m"; }
fail() { echo -e "\033[1;31m[XATO] $*\033[0m"; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Skriptni root sifatida ishga tushiring (avval: sudo -i)"
grep -qiE 'ubuntu|debian' /etc/os-release || fail "Faqat Ubuntu yoki Debian serverlari qo'llab-quvvatlanadi"
export DEBIAN_FRONTEND=noninteractive

log "1/7 Tizim paketlari o'rnatilmoqda"
apt-get update -y -qq
apt-get install -y -qq curl git ca-certificates gnupg openssl iproute2 >/dev/null

TOTAL_MB=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_MB" -lt 1900 ] && ! swapon --show | grep -q .; then
  log "Xotira kam (${TOTAL_MB} MB) — 2 GB swap qo'shilmoqda"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "2/7 Node.js tekshirilmoqda"
NODE_MAJOR=$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0)
if [ "${NODE_MAJOR:-0}" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
command -v pm2 >/dev/null || npm install -g pm2 --silent
echo "Node $(node -v), npm $(npm -v)"

log "3/7 Kod yuklanmoqda"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$DIR" reset --hard FETCH_HEAD
else
  git clone --depth 1 -b "$BRANCH" "$REPO" "$DIR"
fi

log "4/7 Server manzili aniqlanmoqda"
valid_ip() { [[ "$1" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; }
IP="${SERVER_IP:-}"
valid_ip "$IP" || IP=$(curl -s --max-time 3 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address || true)
valid_ip "$IP" || IP=$(curl -s --max-time 5 https://api.ipify.org || true)
valid_ip "$IP" || IP=$(curl -s --max-time 5 https://ifconfig.me || true)
valid_ip "$IP" || fail "Serverning IP manzilini aniqlab bo'lmadi. Buyruq boshiga SERVER_IP='1.2.3.4' qo'shib qayta urinib ko'ring."
HOST="$(echo "$IP" | tr . -).sslip.io"
echo "IP: $IP  →  https://$HOST"

old_value() { [ -f "$ENV_FILE" ] && grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/' || true; }

PORT_VALUE=$(old_value PORT)
if [ -z "$PORT_VALUE" ]; then
  PORT_VALUE=3000
  if ss -ltn | grep -qE "[:.]3000 "; then PORT_VALUE=3070; fi
fi

log "5/7 Sozlamalar (.env)"
if [ -n "${DATABASE_URL:-}" ]; then
  : "${BOT_TOKEN:?BOT_TOKEN berilmagan}" "${DIRECTOR_TELEGRAM_ID:?DIRECTOR_TELEGRAM_ID berilmagan}"
  : "${ADMIN_LOGIN:?ADMIN_LOGIN berilmagan}" "${ADMIN_PASSWORD:?ADMIN_PASSWORD berilmagan}"
  JWT=$(old_value JWT_SECRET); [ -n "$JWT" ] || JWT=$(openssl rand -hex 24)
  AI_KEY="${ANTHROPIC_API_KEY:-$(old_value ANTHROPIC_API_KEY)}"
  MODEL="${CLAUDE_MODEL:-$(old_value CLAUDE_MODEL)}"; MODEL="${MODEL:-claude-opus-5-5}"
  cat > "$ENV_FILE" <<EOF
DATABASE_URL="$DATABASE_URL"
BOT_TOKEN="$BOT_TOKEN"
ANTHROPIC_API_KEY="$AI_KEY"
CLAUDE_MODEL="$MODEL"
DIRECTOR_TELEGRAM_ID="$DIRECTOR_TELEGRAM_ID"
ADMIN_LOGIN="$ADMIN_LOGIN"
ADMIN_PASSWORD="$ADMIN_PASSWORD"
JWT_SECRET="$JWT"
WEBAPP_URL="https://$HOST"
DASHBOARD_PUBLIC="true"
PORT=$PORT_VALUE
EOF
  chmod 600 "$ENV_FILE"
  echo ".env yozildi"
elif [ -f "$ENV_FILE" ]; then
  echo "Avvalgi .env saqlanib qoldi"
else
  fail ".env topilmadi. Buyruqni sozlamalar (DATABASE_URL, BOT_TOKEN ...) bilan birga ishga tushiring."
fi

log "6/7 Paketlar o'rnatilmoqda va ilova tayyorlanmoqda (3–6 daqiqa)"
cd "$APP"
npm ci --include=dev --no-audit --no-fund --loglevel=error
npm run build --silent

log "7/7 Ishga tushirilmoqda"
pm2 delete rahbar >/dev/null 2>&1 || true
pm2 start npm --name rahbar --cwd "$APP" -- run start:prod >/dev/null
pm2 save >/dev/null
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

HTTPS_OK=0
if ss -ltnp | grep -E "[:.](80|443) " | grep -vq caddy; then
  warn "80/443 portlari boshqa dastur (masalan nginx) tomonidan band — HTTPS avtomatik sozlanmadi."
  warn "Shu oynaning rasmini yuboring, birga sozlaymiz."
else
  if ! command -v caddy >/dev/null; then
    if ! apt-get install -y -qq caddy >/dev/null 2>&1; then
      apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https >/dev/null
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
      chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
      apt-get update -y -qq && apt-get install -y -qq caddy >/dev/null
    fi
  fi
  BLOCK="$HOST {
	reverse_proxy 127.0.0.1:$PORT_VALUE
}"
  if [ ! -f /etc/caddy/Caddyfile ] || grep -q '/usr/share/caddy' /etc/caddy/Caddyfile; then
    echo "$BLOCK" > /etc/caddy/Caddyfile
  elif ! grep -q "^$HOST" /etc/caddy/Caddyfile; then
    printf '\n%s\n' "$BLOCK" >> /etc/caddy/Caddyfile
  fi
  if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
    ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null
  fi
  systemctl enable caddy >/dev/null 2>&1 || true
  if systemctl restart caddy; then
    HTTPS_OK=1
  else
    warn "Caddy (HTTPS) ishga tushmadi: journalctl -u caddy --no-pager | tail -20"
  fi
fi

sleep 8
pm2 restart rahbar >/dev/null
sleep 6
echo
echo "================================================================"
if curl -s --max-time 5 "http://127.0.0.1:$PORT_VALUE/api/health" | grep -q ok; then
  echo -e "\033[1;32m ✅ Tizim ishga tushdi!\033[0m"
else
  echo -e "\033[1;31m ❌ Tizim ishga tushmadi. Quyidagi xatoning rasmini yuboring:\033[0m"
  pm2 logs rahbar --lines 30 --nostream
fi
if [ "$HTTPS_OK" -eq 1 ]; then
  echo " 🌐 Dashboard:  https://$HOST/dashboard"
  echo " 📱 Mini App:   https://$HOST/app/"
fi
echo " 🔁 Yangilash uchun shu buyruqni qayta ishga tushiring."
echo " 📜 Loglar:     pm2 logs rahbar"
echo "================================================================"
