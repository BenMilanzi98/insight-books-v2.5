#!/usr/bin/env bash
# Run ON the VPS after receiving a local build bundle. No next build — restart only.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PM2_NAME="${PM2_NAME:-insightdev}"

echo "==> InsightBooks VPS reload ($ROOT)"

if [ ! -f .next/BUILD_ID ]; then
  echo "ERROR: .next/BUILD_ID missing. Push a production build before reload."
  exit 1
fi

echo "==> npm ci (Linux native modules, production only)"
npm ci --omit=dev

echo "==> prisma generate"
npx prisma generate

echo "==> prisma migrate deploy"
npx prisma migrate deploy

echo "==> fix cross-platform Next paths"
node scripts/fix-next-deploy-paths.cjs

echo "==> pm2 restart $PM2_NAME"
pm2 restart "$PM2_NAME"

echo "==> done — tail logs with: pm2 logs $PM2_NAME --lines 30"
