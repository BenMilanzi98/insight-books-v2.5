# Task 4 Report: GitHub Actions release workflow

**Date:** 2026-08-11  
**Scope:** Phase 1 CI — `.github/workflows/release.yml`  
**Status:** Complete

---

## Summary

Created `.github/workflows/release.yml` per brief: triggers on `v*` tags, runs CI production build, packs `insight-books-<tag>.tar.gz` (includes `scripts/vps-apply-release.sh`), and publishes via `softprops/action-gh-release@v2`.

---

## Changes Made

### `.github/workflows/release.yml` (new)

- **Trigger:** `push.tags: v*`
- **Build path:** same as Task 3 (`npm ci` → `build:ci` → manifest → prune cache)
- **DATABASE_URL:** uses fixed Ensure pattern from `build.yml` (always writes secret or CI fallback to `GITHUB_ENV`)
- **Tarball:** `.next`, `public`, `package.json`, `package-lock.json`, `prisma`, `next.config.mjs`, `scripts/vps-apply-release.sh`, `scripts/ci-write-build-manifest.mjs`
- **Release:** `softprops/action-gh-release@v2` with `generate_release_notes: true`, `fail_on_unmatched_files: true`

---

## Verification

```bash
node -e "const fs=require('fs'); const y=fs.readFileSync('.github/workflows/release.yml','utf8'); if(!y.includes('tags:')||!y.includes('softprops/action-gh-release')) process.exit(1); console.log('release.yml ok');"
```

**Result:** `release.yml ok` (exit 0)

---

## Commits

None (per task instructions).

---

## Concerns / Notes

1. **Not run end-to-end** — Workflow validated locally only; first real run happens on first `v*` tag push.
2. **`DATABASE_URL` secret** — Optional; CI fallback used when unset (same as build workflow).
3. **Depends on Task 5** — `scripts/vps-apply-release.sh` must exist in repo at tag time (present on branch).
4. **Permissions** — Job needs `contents: write` for release creation (configured).

---

## Next Steps (out of scope)

- Push a `v*` tag to smoke-test release asset upload
- Configure `DATABASE_URL` repo secret if build requires real DB at release time
