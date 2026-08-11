# Task 6 Report: Wire release tarball + final checklist

**Date:** 2026-08-11  
**Scope:** Phase 1 CI — final verification and success-criteria checklist  
**Status:** Complete (automated checks pass; manual GitHub steps pending operator)

---

## Summary

Task 6 confirms Phase 1 CI wiring is in place: release tarball includes the VPS apply script, accounting-verify workflow was left untouched, and all required Phase 1 files and config are present.

---

## Step 1: `accounting-verify.yml` unchanged

```bash
git diff -- .github/workflows/accounting-verify.yml
```

**Result:** empty diff (exit 0). No modifications from Phase 1 work.

---

## Step 2: Phase 1 files existence check

Ran the brief's node check (via equivalent script; PowerShell quoting on inline `-e` is unreliable).

**Result:** `phase1 files ok` (exit 0)

Verified:

| Item | Status |
|------|--------|
| `next.config.mjs` | present; includes `optimizePackageImports` and `./insight/**/*` |
| `.github/workflows/build.yml` | present |
| `.github/workflows/release.yml` | present |
| `scripts/vps-apply-release.sh` | present |
| `scripts/ci-write-build-manifest.mjs` | present |
| `package.json` → `scripts.build:ci` | present |

---

## Step 3: Release tarball wiring

Confirmed `.github/workflows/release.yml` pack step includes `scripts/vps-apply-release.sh` in the tarball list (line 72), alongside `.next`, `public`, `package.json`, `package-lock.json`, `prisma`, `next.config.mjs`, and `scripts/ci-write-build-manifest.mjs`.

---

## Phase 1 success-criteria checklist

| Criterion | Automated | Manual (operator after push) |
|-----------|-----------|------------------------------|
| Branch push → Production build green + artifact | — | **Pending** |
| PR open/update → build runs | — | **Pending** |
| Tag `v0.0.0-ci-test` → Release with `insight-books-v0.0.0-ci-test.tar.gz` | — | **Pending** |
| VPS scratch: unpack, `npm ci --omit=dev`, no `next build` needed | — | **Pending** |
| `accounting-verify.yml` unchanged | **Pass** | — |
| All Phase 1 files + `build:ci` + next.config gates | **Pass** | — |
| Release tar includes `vps-apply-release.sh` | **Pass** | — |

---

## Spec coverage (Phase 1)

| Spec requirement | Task | Status |
|------------------|------|--------|
| Branch push + PR `build:clean` equivalent | Tasks 2–3 (`build:ci`) | wired (manual verify pending) |
| Artifact upload | Task 3 | wired (manual verify pending) |
| `v*` Release tarball | Task 4 | wired (manual verify pending) |
| VPS apply without build | Task 5 | script present; tar wired (manual verify pending) |
| Tracing excludes `insight/` etc. | Task 1 | config check pass |
| `optimizePackageImports` lucide/recharts | Task 1 | config check pass |
| Keep accounting-verify separate | Task 6 | pass |
| No standalone by default | Task 1 | unchanged |

---

## Commits

None (per task instructions).

---

## Concerns / Notes

1. **Manual GitHub verification not run** — Push, PR build, tag release, and VPS scratch deploy require operator action after branch is pushed.
2. **PowerShell inline node `-e`** — Brief one-liner fails under PowerShell due to quote escaping; equivalent check passed via script file.
3. **End-to-end release path untested locally** — Tar layout and VPS apply script validated by inspection and file checks only.

---

## Next steps (operator)

1. Push branch → confirm Actions “Production build” succeeds and artifact is downloadable.
2. Open/update PR → confirm build runs on PR.
3. Tag `v0.0.0-ci-test` on a built commit → confirm Release asset `insight-books-v0.0.0-ci-test.tar.gz` (delete tag/release after test).
4. On scratch VPS directory: unpack tarball, `npm ci --omit=dev`, confirm `.next` present without running `next build`.
