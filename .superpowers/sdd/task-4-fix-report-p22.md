# Task 4 Fix Report — Phase 22 Wave 4 (Important review remediations)

**Date:** 2026-07-31  
**Status:** COMPLETE (GREEN)  
**Commit:** none (WORKING_TREE only)  
**Review:** `.superpowers/sdd/task-4-review-p22.md`

---

## Important fixes

### 1. Overview false load claim — FIXED

`app/insightbooks/customer-success/training/page.js` no longer claims card counts “load via” `getTrainingOverviewCards`. Copy states thin placeholder — counts **not loaded** on this hub (`UNAVAILABLE` / null); server metrics API still gates to UNAVAILABLE / null when called. Wave 4 test asserts `not loaded|thin placeholder` and rejects `Card counts load via`.

### 2. Search query-fail empty success — FIXED

`lib/admin/customerSuccess/training/search.js` — any `findMany` catch returns:

- `ok: false`
- `status: UNAVAILABLE`
- `results: null` (not `[]`)
- `reason: training_search_query_failed`
- `meta.failClosed` / `inventEmptyForbidden`

Aligned with export query-fail honesty. Wave 4 regression added in the metrics/search/export case.

---

## GREEN

```text
npx vitest run \
  test/systemAdmin.cs.trainingPhase22Wave1.test.js \
  test/systemAdmin.cs.trainingPhase22Wave2.test.js \
  test/systemAdmin.cs.trainingPhase22Wave3.test.js \
  test/systemAdmin.cs.trainingPhase22Wave4.test.js \
  test/systemAdmin.cs.trainingWave4.test.js

 Test Files  5 passed (5)
      Tests  51 passed (51)
```

---

## Paths touched

- `app/insightbooks/customer-success/training/page.js`
- `lib/admin/customerSuccess/training/search.js`
- `test/systemAdmin.cs.trainingPhase22Wave4.test.js`
- `.superpowers/sdd/task-4-fix-report-p22.md`
- `.superpowers/sdd/task-4-report-p22.md` (append)

**Next:** Ready for SDD final whole-branch review (Important #1–#2 cleared).
