#!/bin/bash
set -e

PM2_NAME="powchain"
SRV="/root/POWCHAIN/POWCHAIN/server.js"

echo "[1] Arrêt ancien PM2 (si présent)…"
pm2 stop "$PM2_NAME" 2>/dev/null || true
pm2 delete "$PM2_NAME" 2>/dev/null || true

echo "[2] Forcer le port WebSocket POWCHAIN sur 2053 (si ancien 7001)…"
if grep -q "7001" "$SRV"; then
  sed -i 's/7001/2053/g' "$SRV"
fi

echo "[3] Ouvrir firewall sur 2053/tcp (si UFW actif)…"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 2053/tcp || true
fi

echo "[4] Relancer POWCHAIN sous PM2…"
pm2 start "$SRV" --name "$PM2_NAME"
pm2 save

echo "[5] Résumé :"
pm2 list
echo "Ports :"
lsof -i :3000 || true
lsof -i :2053 || true