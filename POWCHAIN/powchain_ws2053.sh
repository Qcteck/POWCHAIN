#!/bin/bash
set -e
NAME="powchain"
SRV="/root/POWCHAIN/server.js"

echo "[1] Stop ancien PM2"
pm2 stop "$NAME" 2>/dev/null || true
pm2 delete "$NAME" 2>/dev/null || true

echo "[2] Lancer POWCHAIN"
pm2 start "$SRV" --name "$NAME"
pm2 save

echo "[3] Résumé PM2"
pm2 list

echo "[4] Ports"
lsof -i :3000 || true
lsof -i :2053 || true