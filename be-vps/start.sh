#!/usr/bin/env bash
set -e

echo "================================================================"
echo "  KHOI DONG BACKEND CON DUONG DOC LAP TREN VPS 180.93.126.40"
echo "================================================================"

# Mo cong 4000 tren UFW / Firewalld neu co
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow 4000/tcp >/dev/null 2>&1 || true
fi
if command -v firewall-cmd >/dev/null 2>&1; then
  sudo firewall-cmd --permanent --add-port=4000/tcp >/dev/null 2>&1 || true
  sudo firewall-cmd --reload >/dev/null 2>&1 || true
fi

# Neu co PM2 thi chay ngam 24/7 voi PM2, neu khong thi chay node server.js
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete conduongdoclap-be >/dev/null 2>&1 || true
  pm2 start ecosystem.config.cjs
  pm2 save
  echo "[OK] Da khoi dong Backend chay ngam 24/7 bang PM2 tai http://180.93.126.40:4000"
else
  echo "[INFO] Dang chay truc tiep bang Node.js tai http://180.93.126.40:4000 ..."
  node server.js
fi
