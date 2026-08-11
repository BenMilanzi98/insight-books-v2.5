#!/usr/bin/env bash
# Apply a GitHub Release build tarball on a low-RAM VPS (no next build).
# Usage:
#   GITHUB_REPO=owner/repo RELEASE_TAG=v2.5.1 ./scripts/vps-apply-release.sh
# Optional: APP_DIR=/var/www/insight-books GH_TOKEN=... SKIP_MIGRATE=1
#           PM2_APP=insight-books or SYSTEMD_UNIT=insight-books.service
set -euo pipefail

GITHUB_REPO="${GITHUB_REPO:?Set GITHUB_REPO=owner/repo}"
RELEASE_TAG="${RELEASE_TAG:?Set RELEASE_TAG=vX.Y.Z}"
APP_DIR="${APP_DIR:-$(pwd)}"
ARCHIVE="insight-books-${RELEASE_TAG}.tar.gz"
API="https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${RELEASE_TAG}"

cd "${APP_DIR}"

echo "==> Fetching release ${RELEASE_TAG} for ${GITHUB_REPO}"
AUTH_HEADER=()
if [ -n "${GH_TOKEN:-}" ]; then
  AUTH_HEADER=(-H "Authorization: Bearer ${GH_TOKEN}")
fi

ASSET_URL="$(curl -fsSL "${AUTH_HEADER[@]}" "${API}" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);const a=(j.assets||[]).find(x=>x.name==='${ARCHIVE}'); if(!a){console.error('Asset not found: ${ARCHIVE}'); process.exit(1)}; console.log(a.url);})")"

echo "==> Downloading ${ARCHIVE}"
curl -fsSL "${AUTH_HEADER[@]}" -H "Accept: application/octet-stream" -o "${ARCHIVE}" "${ASSET_URL}"

if [ -n "${PM2_APP:-}" ]; then
  echo "==> Stopping PM2 app ${PM2_APP}"
  pm2 stop "${PM2_APP}" || true
elif [ -n "${SYSTEMD_UNIT:-}" ]; then
  echo "==> Stopping systemd unit ${SYSTEMD_UNIT}"
  sudo systemctl stop "${SYSTEMD_UNIT}" || true
else
  echo "==> No PM2_APP or SYSTEMD_UNIT set; stop the app before unpacking."
fi

HAD_PREVIOUS_NEXT=0
if [ -d ".next" ]; then
  echo "==> Preserving current .next as .next.prev"
  rm -rf .next.prev
  mv .next .next.prev
  HAD_PREVIOUS_NEXT=1
fi

echo "==> Unpacking into ${APP_DIR} (preserves .env and uploads/)"
tar -xzf "${ARCHIVE}"
rm -f "${ARCHIVE}"

echo "==> Installing production dependencies"
npm ci --omit=dev

# Ensure Prisma CLI matches package-lock (devDependency omitted by --omit=dev)
PRISMA_VER="$(node -e "const l=require('./package-lock.json'); const p=l.packages?.['node_modules/prisma']?.version || l.dependencies?.prisma?.version; if(!p) process.exit(1); process.stdout.write(p)")"

echo "==> Prisma generate"
npx --yes "prisma@${PRISMA_VER}" generate

if [ "${SKIP_MIGRATE:-0}" != "1" ]; then
  echo "==> Prisma migrate deploy"
  npx --yes "prisma@${PRISMA_VER}" migrate deploy
fi

if [ -n "${PM2_APP:-}" ]; then
  echo "==> Starting PM2 app ${PM2_APP}"
  pm2 start "${PM2_APP}" || pm2 restart "${PM2_APP}"
elif [ -n "${SYSTEMD_UNIT:-}" ]; then
  echo "==> Starting systemd unit ${SYSTEMD_UNIT}"
  sudo systemctl start "${SYSTEMD_UNIT}"
else
  echo "==> Done. Start the app with:"
  echo "    ./node_modules/.bin/next start"
  echo "    (or: node node_modules/next/dist/bin/next start)"
fi

if [ "${HAD_PREVIOUS_NEXT}" = "1" ]; then
  echo "==> Previous build retained at .next.prev"
  echo "    To restore: rm -rf .next && mv .next.prev .next"
fi

echo "    Do NOT run build:clean / next build on this host."
