# Phase 1 Low-RAM CI + Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build production artifacts on GitHub Actions for every branch/PR, publish versioned Release tarballs on `v*` tags for 4 GB VPS deploy without on-server compile, and apply light `next.config.mjs` RAM/import optimizations.

**Architecture:** Separate `build.yml` (push/PR → artifact) and `release.yml` (tag → GitHub Release asset). VPS uses `scripts/vps-apply-release.sh` to download/unpack and `next start`. Config excludes heavy trees from tracing and enables `optimizePackageImports` for lucide/recharts. Existing `accounting-verify.yml` stays for tests.

**Tech Stack:** GitHub Actions (`ubuntu-latest`), Node 20, Next.js 16 webpack production build, Prisma, `softprops/action-gh-release`, bash VPS helper.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-11-phase1-low-ram-ci-release-design.md` — follow locked decisions exactly.
- Build host / CI ~8 GB; runtime VPS ~4 GB — **never** run `build:clean` / `next build` on the VPS apply path.
- Auto build on **all branch pushes** and **pull_request**.
- Releases only on tags matching `v*`.
- Do not enable `output: 'standalone'` by default.
- Do not merge full test suite into the heavy build job; leave `accounting-verify.yml` alone.
- No intentional product/feature behavior changes.
- Do not commit unless the user explicitly asks.
- Prefer checkout **without** submodules so nested `insight/` is not fetched for CI builds.

---

## File map

| File | Responsibility |
|------|----------------|
| `next.config.mjs` | Tracing excludes + `optimizePackageImports` |
| `package.json` | Add `build:ci` (6144 MB heap twin of `build:clean`) |
| `.github/workflows/build.yml` | Branch/PR production build + artifact |
| `.github/workflows/release.yml` | Tag build + GitHub Release tarball |
| `scripts/vps-apply-release.sh` | VPS download/unpack/restart without building |
| `scripts/ci-write-build-manifest.mjs` | Small JSON manifest written into artifact |

---

### Task 1: next.config tracing + optimizePackageImports

**Files:**
- Modify: `next.config.mjs`

**Interfaces:**
- Consumes: existing `outputFileTracingExcludes` and `experimental` blocks
- Produces: wider excludes + `experimental.optimizePackageImports`

- [ ] **Step 1: Update `outputFileTracingExcludes` and `experimental`**

In `next.config.mjs`, replace the `outputFileTracingExcludes` and `experimental` sections with:

```js
  outputFileTracingExcludes: {
    '*': [
      './uploads/**/*',
      './tmp/**/*',
      './.cursor/**/*',
      './docs/**/*',
      './storage/**/*',
      './insight/**/*',
      './android-app-center/**/*',
      './insight_books_android/**/*',
      './starter-for-nextjs/**/*',
      './test/**/*',
      './tests/**/*',
      './artifacts/**/*',
      './backups/**/*',
      './node_modules/@swc/core*/**/*',
      './node_modules/next/dist/server/lib/squoosh/**/*',
      './**/*.docx',
      './**/*.pdf',
      './**/*.xlsx',
    ],
  },
  transpilePackages: ['qrcode.react'],
  productionBrowserSourceMaps: false,
  experimental: {
    // Lower peak memory during webpack production builds (helps small VPSs).
    webpackMemoryOptimizations: true,
    cpus: 1,
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
```

Keep all other existing keys (`turbopack`, `compiler`, standalone spread, `webpack`, `images`, `headers`, `serverExternalPackages`, `generateBuildId`, `redirects`) unchanged.

- [ ] **Step 2: Syntax-check the config**

Run:

```bash
node --check next.config.mjs
```

Expected: exit code 0, no output.

- [ ] **Step 3: Commit**

Skip unless the user explicitly asks to commit.

---

### Task 2: Add `build:ci` script + build manifest helper

**Files:**
- Modify: `package.json` (scripts section)
- Create: `scripts/ci-write-build-manifest.mjs`

**Interfaces:**
- Consumes: env `GITHUB_SHA`, `GITHUB_REF_NAME`, `GITHUB_REF` (optional locally)
- Produces: `npm run build:ci`; writes `.next/ci-build-manifest.json` after build when invoked

- [ ] **Step 1: Add `build:ci` next to `build:clean` in `package.json`**

Locate the existing script:

```json
"build:clean": "rimraf .next && prisma generate && cross-env NODE_ENV=production NODE_OPTIONS=--max-old-space-size=8192 next build --webpack",
```

Immediately after it, add:

```json
"build:ci": "rimraf .next && prisma generate && cross-env NODE_ENV=production NODE_OPTIONS=--max-old-space-size=6144 next build --webpack",
```

Do not change `build:clean` behavior (local/high-RAM still 8192). CI workflows must call `build:ci` (CI-tuned equivalent of `build:clean`).

- [ ] **Step 2: Create `scripts/ci-write-build-manifest.mjs`**

```js
import fs from 'fs';
import path from 'path';

const outDir = path.join(process.cwd(), '.next');
if (!fs.existsSync(outDir)) {
  console.error('ci-write-build-manifest: .next missing — run build first');
  process.exit(1);
}

const sha = process.env.GITHUB_SHA || process.env.GIT_SHA || '';
const ref = process.env.GITHUB_REF_NAME || process.env.GITHUB_REF || '';
const manifest = {
  gitSha: sha,
  gitRef: ref,
  nodeVersion: process.version,
  builtAt: new Date().toISOString(),
  nextBuildId: 'build',
};

const dest = path.join(outDir, 'ci-build-manifest.json');
fs.writeFileSync(dest, JSON.stringify(manifest, null, 2) + '\n');
console.log('Wrote', dest);
```

- [ ] **Step 3: Smoke the manifest script without a full build**

Run:

```bash
mkdir -p .next && node scripts/ci-write-build-manifest.mjs && type .next\ci-build-manifest.json
```

(On bash: `cat .next/ci-build-manifest.json`.)

Expected: JSON with `builtAt` and `nodeVersion`.

- [ ] **Step 4: Commit**

Skip unless the user explicitly asks to commit.

---

### Task 3: GitHub Actions branch/PR build workflow

**Files:**
- Create: `.github/workflows/build.yml`

**Interfaces:**
- Consumes: `npm run build:ci`, `scripts/ci-write-build-manifest.mjs`
- Produces: Actions artifact `next-build-<ref>-<sha>` containing `.next/` (no cache)

- [ ] **Step 1: Create `.github/workflows/build.yml` with this exact content**

```yaml
name: Production build

on:
  push:
    branches:
      - '**'
  pull_request:

concurrency:
  group: production-build-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 90
    permissions:
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: false

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Production build (CI build:clean)
        run: npm run build:ci
        env:
          NODE_ENV: production
          # Provide dummy values if pages require env at build time; override via repo Variables/Secrets as needed.
          DATABASE_URL: ${{ secrets.DATABASE_URL || 'postgresql://ci:ci@127.0.0.1:5432/ci?schema=public' }}

      - name: Write CI build manifest
        run: node scripts/ci-write-build-manifest.mjs
        env:
          GITHUB_SHA: ${{ github.sha }}
          GITHUB_REF_NAME: ${{ github.ref_name }}

      - name: Prune Next cache from artifact
        run: rm -rf .next/cache

      - name: Sanitize artifact name parts
        id: meta
        run: |
          REF="${GITHUB_REF_NAME}"
          REF_SAFE="$(echo "$REF" | sed 's/[^a-zA-Z0-9._-]/-/g' | cut -c1-60)"
          SHA_SHORT="$(echo "$GITHUB_SHA" | cut -c1-7)"
          echo "artifact_name=next-build-${REF_SAFE}-${SHA_SHORT}" >> "$GITHUB_OUTPUT"

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${{ steps.meta.outputs.artifact_name }}
          path: .next
          if-no-files-found: error
          retention-days: ${{ github.event_name == 'pull_request' && 7 || 14 }}
```

Note: If GitHub Actions expression `secrets.DATABASE_URL || '...'` is rejected by the workflow parser, replace the `DATABASE_URL` line with:

```yaml
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

and add a preceding step that sets a fallback:

```yaml
      - name: Ensure DATABASE_URL for build
        run: |
          if [ -z "${DATABASE_URL}" ]; then
            echo "DATABASE_URL=postgresql://ci:ci@127.0.0.1:5432/ci?schema=public" >> "$GITHUB_ENV"
          fi
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

- [ ] **Step 2: Validate YAML parses**

Run (from repo root):

```bash
node -e "const fs=require('fs'); const y=fs.readFileSync('.github/workflows/build.yml','utf8'); if(!y.includes('npm run build:ci')) process.exit(1); console.log('build.yml ok', y.split(/\n/).length, 'lines');"
```

Expected: `build.yml ok` with line count.

- [ ] **Step 3: Commit**

Skip unless the user explicitly asks to commit.

---

### Task 4: GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: same build path as Task 3
- Produces: GitHub Release for tag `v*` with asset `insight-books-<tag>.tar.gz`

- [ ] **Step 1: Create `.github/workflows/release.yml` with this exact content**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false

jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 90

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: false

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Ensure DATABASE_URL for build
        run: |
          if [ -z "${DATABASE_URL}" ]; then
            echo "DATABASE_URL=postgresql://ci:ci@127.0.0.1:5432/ci?schema=public" >> "$GITHUB_ENV"
          fi
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Production build (CI build:clean)
        run: npm run build:ci
        env:
          NODE_ENV: production

      - name: Write CI build manifest
        run: node scripts/ci-write-build-manifest.mjs
        env:
          GITHUB_SHA: ${{ github.sha }}
          GITHUB_REF_NAME: ${{ github.ref_name }}

      - name: Prune Next cache
        run: rm -rf .next/cache

      - name: Pack release tarball
        id: pack
        run: |
          TAG="${GITHUB_REF_NAME}"
          ARCHIVE="insight-books-${TAG}.tar.gz"
          tar -czf "${ARCHIVE}" \
            --exclude='.next/cache' \
            .next \
            public \
            package.json \
            package-lock.json \
            prisma \
            next.config.mjs \
            scripts/vps-apply-release.sh \
            scripts/ci-write-build-manifest.mjs
          echo "archive=${ARCHIVE}" >> "$GITHUB_OUTPUT"
          ls -lh "${ARCHIVE}"

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: ${{ steps.pack.outputs.archive }}
          generate_release_notes: true
          fail_on_unmatched_files: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Important: Task 5 must create `scripts/vps-apply-release.sh` **before** the first tag release, or temporarily remove that path from the `tar` list until Task 5 lands. Implement Task 5 in the same PR as Task 4 so the pack step succeeds.

- [ ] **Step 2: Validate YAML contains tag trigger and release action**

Run:

```bash
node -e "const fs=require('fs'); const y=fs.readFileSync('.github/workflows/release.yml','utf8'); if(!y.includes(\"tags:\")||!y.includes('softprops/action-gh-release')) process.exit(1); console.log('release.yml ok');"
```

Expected: `release.yml ok`.

- [ ] **Step 3: Commit**

Skip unless the user explicitly asks to commit.

---

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

### Task 6: Wire release tarball + final checklist

**Files:**
- Verify: `.github/workflows/release.yml` tar list includes `scripts/vps-apply-release.sh`
- Verify: `.github/workflows/accounting-verify.yml` unchanged

**Interfaces:**
- Consumes: Tasks 1–5 outputs
- Produces: Phase 1 success-criteria checklist in the task report

- [ ] **Step 1: Confirm `accounting-verify.yml` was not modified**

Run:

```bash
git diff -- .github/workflows/accounting-verify.yml
```

Expected: empty diff (or only unrelated prior changes — do not edit this file in Phase 1).

- [ ] **Step 2: Confirm all Phase 1 files exist**

Run:

```bash
node -e "const fs=require('fs'); const need=['next.config.mjs','.github/workflows/build.yml','.github/workflows/release.yml','scripts/vps-apply-release.sh','scripts/ci-write-build-manifest.mjs']; for (const f of need){ if(!fs.existsSync(f)) { console.error('missing',f); process.exit(1);} } const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); if(!pkg.scripts['build:ci']) { console.error('missing build:ci'); process.exit(1);} const cfg=fs.readFileSync('next.config.mjs','utf8'); if(!cfg.includes(\"optimizePackageImports\")||!cfg.includes('./insight/**/*')) { console.error('next.config incomplete'); process.exit(1);} console.log('phase1 files ok');"
```

Expected: `phase1 files ok`.

- [ ] **Step 3: Manual GitHub verification (after push — operator)**

1. Push a branch → Actions “Production build” green → artifact downloadable.
2. Open/update a PR → build runs.
3. Tag `v0.0.0-ci-test` on a built commit (delete later) → Release with `insight-books-v0.0.0-ci-test.tar.gz`.
4. On a scratch directory simulating VPS: unpack tarball, `npm ci --omit=dev`, confirm **no** `next build` required to have `.next` present.

- [ ] **Step 4: Commit**

Skip unless the user explicitly asks to commit.

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| Branch push + PR `build:clean` equivalent | Tasks 2–3 (`build:ci`) |
| Artifact upload | Task 3 |
| `v*` Release tarball | Task 4 |
| VPS apply without build | Task 5 |
| Tracing excludes `insight/` etc. | Task 1 |
| `optimizePackageImports` lucide/recharts | Task 1 |
| Keep accounting-verify separate | Task 6 |
| No standalone by default | Task 1 (no change to standalone gate) |

## Placeholder scan

No TBD steps. Commit steps are explicit no-ops unless user asks. DATABASE_URL fallback is specified for CI builds that need a string at compile time.
