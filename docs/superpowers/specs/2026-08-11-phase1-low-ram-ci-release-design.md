# Design: Phase 1 — Low-RAM Deploy + GitHub Actions Build/Release

**Date:** 2026-08-11  
**Status:** Approved (Approach A)  
**Targets:** Build host / GitHub Actions ~8 GB RAM · Runtime VPS ~4 GB RAM

## Problem

InsightBooks production builds already require large Node heaps (`NODE_OPTIONS=6–8GB`) and serialized webpack. Building on a 4 GB VPS OOMs or is impractical. Runtime must stay light: `next start` only. Developers also need automatic production builds on GitHub for **every branch push**, with versioned **Releases** for VPS deploy.

## Decisions (approved)

1. **Both** build survival and later runtime speed — this spec is **Phase 1 only** (build + CI/CD + light config).
2. **Split hosts:** build on ~8 GB (CI); run on ~4 GB VPS without `next build`.
3. **Approach A:** Push → artifact; tag `v*` → GitHub Release with build tarball.
4. **Branch builds:** auto `build:clean` on push to **any branch** (and on pull requests).
5. **Config quick wins:** exclude `insight/` (and similar) from file tracing; `optimizePackageImports` for lucide/recharts.

## Goals

1. GitHub Actions runs `npm run build:clean` on branch pushes and PRs; uploads a downloadable build artifact.
2. Pushing a `v*` tag creates a GitHub Release with a deployable tarball.
3. 4 GB VPS can apply a release and run `next start` without compiling.
4. Reduce build/tracing RAM pressure via `next.config.mjs` excludes + package import optimization.
5. No intentional product/feature behavior changes.

## Non-goals (Phase 1)

- Splitting mega `"use client"` pages (stock/POS/expenses) — Phase 2
- Narrowing root client shell — Phase 2
- Prisma schema / client split — Phase 3
- Separating `app/insightbooks/**` into another deployable — Phase 3
- Turning on `output: 'standalone'` by default
- Merging full test suite into the heavy build job (keep `accounting-verify.yml` separate)

## Architecture

```
Developer push (any branch) ──► workflow: build.yml
                                    │
                                    ├─ npm ci
                                    ├─ npm run build:clean
                                    └─ upload-artifact (.next + manifest)

Developer tag vX.Y.Z ──────────► workflow: release.yml
                                    │
                                    ├─ build:clean (or rebuild at tag SHA)
                                    ├─ pack tarball
                                    └─ softprops/action-gh-release (asset)

VPS ───────────────────────────► download Release asset
                                    │
                                    ├─ unpack over app dir
                                    ├─ npm ci --omit=dev (if needed)
                                    ├─ prisma migrate deploy / generate
                                    └─ next start
```

## Design details

### 1. Workflow — Build (`.github/workflows/build.yml`)

**Triggers**

- `push` — all branches (`**`)
- `pull_request` — opened/synchronize/reopened

**Runner:** `ubuntu-latest` (GitHub-hosted ≈ sufficient for 6 GB Node heap)

**Steps (outline)**

1. `actions/checkout@v4` (submodules: false unless required for build — **do not** checkout nested `insight` submodule for build if avoidable)
2. `actions/setup-node@v4` — Node 20, `cache: npm`
3. `npm ci`
4. `npm run build:clean` with `NODE_OPTIONS=--max-old-space-size=6144` (align with `build:vps` / CI RAM)
5. Upload artifact:
   - Name: `next-build-<sanitized-ref>-<short-sha>`
   - Path: `.next/` (exclude `.next/cache` if present to shrink artifact)
   - Optional: small `build-manifest.json` (git sha, ref, node version, build time)
6. Retention: e.g. 7–14 days for branch builds; PRs shorter (3–7 days)

**Timeout:** 90 minutes  
**Concurrency:** one build per ref (`cancel-in-progress: true` for the same branch)

### 2. Workflow — Release (`.github/workflows/release.yml`)

**Triggers**

- `push` tags matching `v*` (e.g. `v2.5.1`)

**Steps (outline)**

1. Checkout at tag
2. Same Node / `npm ci` / `build:clean` as build workflow
3. Pack deployable archive, e.g. `insight-books-<tag>.tar.gz` containing at least:
   - `.next/` (no cache)
   - `public/` (if required at runtime)
   - `package.json`, `package-lock.json`
   - `prisma/` (schema + migrations)
   - `next.config.mjs`
   - Optional: `scripts/vps-apply-release.sh`
4. Create GitHub Release with the archive attached (`softprops/action-gh-release` or `gh release create`)
5. Release notes: auto-generate or tag message body

**Permissions:** `contents: write` for releases

### 3. VPS apply helper

Add `scripts/vps-apply-release.sh` documenting:

1. Download release asset for tag
2. Stop app process
3. Unpack into app directory (preserve `.env`, `uploads/`)
4. `npm ci --omit=dev`
5. `npx prisma generate` + `npx prisma migrate deploy` (or project’s production migrate command)
6. `next start` (or systemd/pm2 restart)

Do **not** run `build:clean` on the VPS in this script.

### 4. `next.config.mjs` changes

**`outputFileTracingExcludes`** — add (in addition to existing entries):

- `./insight/**/*`
- `./android-app-center/**/*`
- `./insight_books_android/**/*` (if present)
- `./test/**/*` / `./tests/**/*`
- `./artifacts/**/*`
- `./backups/**/*`
- `./starter-for-nextjs/**/*` (if present)

**`experimental.optimizePackageImports`:**

```js
optimizePackageImports: ['lucide-react', 'recharts'],
```

Keep: `webpackMemoryOptimizations`, `cpus: 1`, `parallelism: 1`, standalone opt-in only, existing `serverExternalPackages`.

### 5. Interaction with existing CI

- Leave `.github/workflows/accounting-verify.yml` for tests/gates on main/develop/PRs.
- Phase 1 build workflow focuses on **compile artifact**, not full test matrix (avoids doubling CI minutes and failure coupling).

## Success criteria

1. Push to any branch → Actions build succeeds → artifact downloadable.
2. Open/update PR → build runs.
3. `git tag vX.Y.Z && git push --tags` → Release with tarball asset.
4. Documented VPS path runs app from release **without** `next build`.
5. Config excludes `insight/` from tracing; lucide/recharts import optimization enabled.
6. No intentional UX/API behavior regressions from Phase 1.

## Implementation touchpoints

| Path | Change |
|------|--------|
| `.github/workflows/build.yml` | New — branch/PR build + artifact |
| `.github/workflows/release.yml` | New — tag release + asset |
| `next.config.mjs` | Tracing excludes + optimizePackageImports |
| `scripts/vps-apply-release.sh` | New — VPS apply steps |
| Optional: short note in existing deploy doc | Point VPS to Releases |

## Spec self-review

- Decisions match approval (A + branch builds + config wins).
- Phase 2/3 clearly out of scope.
- No TBD on triggers, artifact purpose, or release trigger.
- Does not require committing `.next` to git; CI artifacts/releases replace VPS-local builds.
