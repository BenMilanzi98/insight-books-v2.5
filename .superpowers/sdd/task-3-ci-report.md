# Task 3 Report: GitHub Actions branch/PR build workflow

**Date:** 2026-08-11  
**Scope:** Phase 1 CI — `.github/workflows/build.yml`  
**Status:** Complete

---

## Summary

Created `Production build` workflow triggered on all branch pushes and pull requests. Runs `npm run build:ci`, writes CI manifest, prunes `.next/cache`, and uploads `.next/` as a sanitized artifact (`next-build-<ref>-<sha>`, 7-day PR / 14-day push retention).

Used the **Ensure DATABASE_URL** fallback step (valid YAML) instead of inline `secrets.DATABASE_URL || '...'` expression.

---

## Changes Made

### `.github/workflows/build.yml` (new)

- Triggers: `push` (all branches), `pull_request`
- Concurrency group with cancel-in-progress
- Node 20, `npm ci`, `build:ci`, manifest script, cache prune, artifact upload
- `DATABASE_URL` fallback: `postgresql://ci:ci@127.0.0.1:5432/ci?schema=public` when secret unset

---

## Verification

```bash
node -e "const fs=require('fs'); const y=fs.readFileSync('.github/workflows/build.yml','utf8'); if(!y.includes('npm run build:ci')) process.exit(1); console.log('build.yml ok', y.split(/\n/).length, 'lines');"
```

**Result:** `build.yml ok 72 lines`

---

## Commits

None (per task instructions).

---

## Concerns / Notes

1. **Not run on GitHub yet** — Workflow validated locally only; first Actions run may surface build-time env gaps beyond `DATABASE_URL`.
2. **Dummy DATABASE_URL** — Build may succeed without a live DB if Next/Prisma only need the var at compile time; runtime pages requiring DB could still fail at build.
3. **Artifact size** — Full `.next/` upload (minus cache) may be large; monitor storage/transfer on first runs.

---

## Next Steps (out of scope)

- Push branch and confirm green Actions run
- Add repo secret `DATABASE_URL` if build requires real schema introspection

---

## Fix: DATABASE_URL not exported when secret is set (2026-08-11)

**Finding:** When `secrets.DATABASE_URL` was set, the Ensure step only wrote to `GITHUB_ENV` when the var was empty—so the build step never received the secret value.

**Change:** Updated `Ensure DATABASE_URL for build` to always export to `GITHUB_ENV`: write the secret when present, otherwise use the CI fallback URL.

**Confirmation:** Fix applied in `.github/workflows/build.yml`; not committed.
