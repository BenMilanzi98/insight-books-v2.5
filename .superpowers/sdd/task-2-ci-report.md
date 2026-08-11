# Task 2 Report: build:ci script + build manifest helper

**Date:** 2026-08-11  
**Scope:** Phase 1 CI — `package.json` scripts + `scripts/ci-write-build-manifest.mjs`  
**Status:** Complete

---

## Summary

Added `build:ci` npm script (6144 MB heap) immediately after `build:clean` without modifying local/high-RAM `build:clean` (8192). Created manifest helper that writes `.next/ci-build-manifest.json` from GitHub/env metadata and Node version.

---

## Changes Made

### `package.json`

Added:

```json
"build:ci": "rimraf .next && prisma generate && cross-env NODE_ENV=production NODE_OPTIONS=--max-old-space-size=6144 next build --webpack",
```

`build:clean` unchanged (8192 heap).

### `scripts/ci-write-build-manifest.mjs` (new)

- Requires `.next` directory; exits 1 with error if missing
- Reads `GITHUB_SHA` / `GIT_SHA`, `GITHUB_REF_NAME` / `GITHUB_REF`
- Writes `.next/ci-build-manifest.json` with `gitSha`, `gitRef`, `nodeVersion`, `builtAt`, `nextBuildId: "build"`

---

## Verification

### Manifest smoke test

```powershell
mkdir .next (if needed); node scripts/ci-write-build-manifest.mjs; Get-Content .next\ci-build-manifest.json
```

**Result:** Exit code 0. Output includes `nodeVersion` (`v24.11.0`) and `builtAt` (`2026-08-11T15:47:34.799Z`). Local run: empty `gitSha` / `gitRef` (no env set).

---

## Commits

None (per task instructions).

---

## Concerns / Notes

1. **`build:ci` vs `build:vps`** — Both use 6144 heap; CI workflows should call `build:ci` per brief (not `build:clean`).
2. **Manifest timing** — Script is standalone; CI workflow must invoke it after `npm run build:ci` (Task 3+).
3. **`nextBuildId`** — Hardcoded `"build"` per brief; real Next build ID not wired yet.
4. **Full build** — Not run in this task; only manifest helper smoke-tested.

---

## Next Steps (out of scope for Task 2)

- Wire CI workflow to `build:ci` + manifest script
- Full CI build smoke on GitHub Actions
