#!/usr/bin/env bash
# Build and restart the app on EC2. Run from repo root (/var/app/taskmanager).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f server/.env ]]; then
  echo "Missing server/.env — copy deploy/env.production.template and fill in secrets."
  exit 1
fi

echo "==> Installing dependencies..."
npm ci

echo "==> Building client + server..."
npm run build

echo "==> Applying database schema..."
cd server && npx prisma db push && cd ..

echo "==> Restarting PM2..."
if pm2 describe taskmanager >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.cjs
else
  pm2 start deploy/ecosystem.config.cjs
fi
pm2 save

echo "==> Health check..."
sleep 2
curl -sf http://127.0.0.1:3001/api/health && echo ""

echo "Deploy complete. PM2 status:"
pm2 status taskmanager
