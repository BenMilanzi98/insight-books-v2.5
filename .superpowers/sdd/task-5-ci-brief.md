### Task 5: VPS apply-release script

**Files:**
- Create: `scripts/vps-apply-release.sh`

**Interfaces:**
- Consumes: env `GITHUB_REPO` (owner/name), `RELEASE_TAG` (e.g. `v2.5.1`), optional `APP_DIR` (default cwd), optional `GH_TOKEN` for private repos
- Produces: unpacked release + `npm ci --omit=dev` + prisma generate/migrate — **no** `next build`

- [ ] **Step 1: Create `scripts/vps-apply-release.sh`**

```bash
#!/usr/bin/env bash
# Apply a GitHub Release build tarball on a low-RAM VPS (no next build).
# Usage:
#   GITHUB_REPO=owner/repo RELEASE_TAG=v2.5.1 ./scripts/vps-apply-release.sh
# Optional: APP_DIR=/var/www/insight-books  GH_TOKEN=...  SKIP_MIGRATE=1
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

echo "==> Unpacking into ${APP_DIR} (preserves .env and uploads/)"
tar -xzf "${ARCHIVE}"
rm -f "${ARCHIVE}"

echo "==> Installing production dependencies"
npm ci --omit=dev

echo "==> Prisma generate"
npx prisma generate

if [ "${SKIP_MIGRATE:-0}" != "1" ]; then
  echo "==> Prisma migrate deploy"
  npx prisma migrate deploy
fi

echo "==> Done. Start the app with: npm run start"
echo "    (or restart pm2/systemd — do NOT run build:clean on this host)"
```

- [ ] **Step 2: Make executable (for Linux VPS / CI pack)**

On Windows (Git Bash / WSL if available):

```bash
git update-index --chmod=+x scripts/vps-apply-release.sh
```

If that fails on Windows, still create the file; the VPS can `chmod +x` after unpack. Document in script header.

- [ ] **Step 3: Dry-run help check**

Run:

```bash
bash -n scripts/vps-apply-release.sh
```

Expected: exit 0.

- [ ] **Step 4: Commit**

Skip unless the user explicitly asks to commit.

---

