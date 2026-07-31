# Task 4 Review — Phase 19 Wave 4 (re-review after export UNAVAILABLE fix)

**Reviewer:** defect-first gate (read-only except this file)  
**Date:** 2026-07-31  
**Base / Head:** WORKING_TREE (live files + prior `task-4-review-package-p19.diff` + fix wave)  
**Brief / report:** `task-4-brief-p19.md` / `task-4-report-p19.md`  
**Focus:** Prior [P2] export `findMany` fail → empty success; Phase 18 Task 4 failure modes

---

## Spec compliance

| Focus rule | Verdict |
|------------|---------|
| Gate fail → UNAVAILABLE / `value: null` (never false zero) | ✅ |
| Search / export / DQ / recon / My Work portfolio fail-closed | ✅ |
| DQ never invents `totalRequests: 0` when model missing | ✅ |
| Recon never invents `lineageIntact: true` | ✅ |
| Foundations broken ≠ COMPLETED | ✅ |
| Export `findMany` throw → UNAVAILABLE (not false-empty) | ✅ **FIXED** — live `exports.js` catch returns `status: UNAVAILABLE`, `ok: false`, `rows: null`, `body: null`, `reason: adoption_export_query_failed` / `error: export_query_failed` |
| Exit `READY_FOR_PHASE_20_WITH_BLOCKERS` | ✅ |
| Vitest Wave 4 export case | ✅ Live re-run: export / DQ / recon case **PASS** (`findMany` reject → UNAVAILABLE) |

---

## Prior finding disposition

| ID | Finding | Status |
|----|---------|--------|
| [P2] Export query failure returns empty success, not UNAVAILABLE | `exports.js` catch no longer maps to `ok: true` / `rows: []`; aligned with training/onboarding export failure shape; Wave 4 test asserts UNAVAILABLE | **Resolved** |

---

## Issues

### Critical

_None._

### Important

_None._

### Minor / notes (not blocking)

- Thin AdminShell hubs document `getAdoptionOverviewCards` but do not wire live fetches (matches reported WITH_BLOCKERS / thin UI scope).
- Recon overall `READY` with `lineageIntact: null` is intentional thin instrumentation, not a success stub of `true`.
- Fail-closed empty portfolio still returns `ok: true` + `rows: []` with `meta.failClosed` — distinct from query failure; correct honesty split.

---

## Assessment

**Approved**

Prior Important export false-empty gap is closed in live code and covered by Vitest. Phase 18 Task 4 failure modes remain remediated. Exit decision `READY_FOR_PHASE_20_WITH_BLOCKERS` is honest.

**Counts:** Critical 0 · Important 0
