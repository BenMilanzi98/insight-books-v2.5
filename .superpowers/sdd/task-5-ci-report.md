# Task 5 Report: VPS apply-release script

**Date:** 2026-08-11  
**Scope:** Phase 1 CI — `scripts/vps-apply-release.sh`  
**Status:** Complete

---

## Summary

Created `scripts/vps-apply-release.sh` per brief: downloads GitHub Release tarball (`insight-books-${RELEASE_TAG}.tar.gz`), unpacks into `APP_DIR`, runs `npm ci --omit=dev`, `prisma generate`, and optional `prisma migrate deploy` — **no** `next build`.

---

## Changes Made

### `scripts/vps-apply-release.sh` (new)

- Requires `GITHUB_REPO`, `RELEASE_TAG`; optional `APP_DIR`, `GH_TOKEN`, `SKIP_MIGRATE`
- Uses GitHub API + curl for asset URL resolution and download
- Preserves existing `.env` and `uploads/` (tar unpack overlay)
- Ends with start/restart guidance (pm2/systemd); warns against `build:clean` on VPS

---

## Verification

```bash
"C:\Program Files\Git\bin\bash.exe" -n scripts/vps-apply-release.sh
```

**Result:** exit 0

**Note:** System `bash` (WSL stub) is unavailable; Git Bash used instead.

**Executable bit:** `git add --chmod=+x scripts/vps-apply-release.sh` succeeded (staged, not committed).

---

## Commits

None (per task instructions).

---

## Concerns / Notes

1. **Not run end-to-end** — Script syntax-validated only; no live release download tested.
2. **Runtime deps** — VPS needs `curl`, `node`, `npm`, and network access to GitHub API/assets.
3. **Private repos** — `GH_TOKEN` required for authenticated asset download via GitHub API.
4. **Tar layout** — Assumes release tarball contents align with `APP_DIR` root (same layout CI pack produces in Task 4).

---

## Next Steps (out of scope)

- Task 4: CI release tarball must include this script
- First VPS deploy: `chmod +x scripts/vps-apply-release.sh` if executable bit lost in transfer

---

## Fix: Prisma CLI + start command (2026-08-11)

**Problems addressed:**
1. `npm ci --omit=dev` omits `cross-env` (devDependency) but `npm run start` requires it
2. `prisma` is a devDependency; bare `npx prisma` after `--omit=dev` is unpinned and may hit network

**Changes in `scripts/vps-apply-release.sh`:**
- After `npm ci --omit=dev`, resolve exact Prisma version from `package-lock.json` and `npm install --no-save prisma@<version>` for generate/migrate only
- Replaced `npm run start` guidance with direct `./node_modules/.bin/next start` (avoids cross-env; no package.json moves)

**Verification:** `bash -n scripts/vps-apply-release.sh` exit 0; lockfile resolves `prisma` → `6.19.3`

**Commits:** None (per instructions)
