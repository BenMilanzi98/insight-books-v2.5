# Task 4 Review — Phase 18 Wave 4 (re-review after fix wave)

**Reviewer:** defect-first gate (read-only)  
**Date:** 2026-07-31  
**Base / Head:** WORKING_TREE (live files, not stale diff)  
**Brief / report:** `task-4-brief-p18.md` / `task-4-report-p18.md` (`## Fix wave`)  
**Prior review:** FAILED — Critical cert search unscoped; Important export/DQ/recon unscoped; Important DQ false-zero requests  
**Focus:** verify fix wave + spot-check gate / foundations / Phase 19 pack / exit

---

## Spec compliance: ✅

| Focus rule | Verdict |
|------------|---------|
| Gate fail → UNAVAILABLE / `value: null` (never false zero) | ✅ `reliabilityGate.js` + metrics/overview |
| List / search fail-closed (portfolio) | ✅ TRQ/TRN + **CERT via `programId` → scoped programs**; empty scope → `[]` |
| Export / DQ / recon portfolio-scoped | ✅ `resolveTrainingListScope` + `tenantWhereFromScope`; empty → fail-closed |
| DQ request model missing ≠ invent 0 | ✅ `UNAVAILABLE` + `totalRequests: null` |
| Foundations broken link ≠ COMPLETED | ✅ `foundations.js` serializeRow → UNKNOWN; `completedAt` cleared |
| Exit `READY_FOR_PHASE_19_WITH_BLOCKERS` | ✅ FINAL_READINESS_DECISION + Phase 19 pack honesty |
| Exports strip answers / tokens | ✅ strip + body sanitization |
| Vitest Wave 4 scope / false-zero | ✅ 9 cases incl. CERT search + export/DQ/recon + request-null (report 9/9; not re-run here) |

---

## Strengths

1. **Certificate search scoped correctly** — `search.js` resolves portfolio programs, filters CERT with `programId: { in: scopedProgramIds }`, drops null/orphan `programId`, and returns early `[]` when `resolveTrainingListScope` fails (empty portfolio / omitted scope). Super Admin `tenantScope: null` remains fleet-wide by design.
2. **Export / DQ / recon aligned with listScope** — same fail-closed pattern as metrics/lists; non–Super Admin cannot enumerate fleet rows/totals without portfolio tenants.
3. **DQ honesty on missing request model** — no fabricated `totalRequests: 0`; status `UNAVAILABLE`, `totalRequests: null`, `falseZeroes: false`.
4. **Regression coverage landed** — Wave 4 test covers CERT visible/hidden/orphan, cert unscoped → `[]`, export/DQ/recon closed vs scoped, and request-model-missing null path.
5. **Phase 19 pack remains honest** — exit `READY_FOR_PHASE_19_WITH_BLOCKERS` with virtual provider / recording / portal / banks called out as typed unavailable / carry blockers.

---

## Issues

### Critical

_None._ Prior Critical (certificate search unscoped) is fixed in live `search.js`.

### Important

_None._ Prior Important items (export/DQ/recon unscoped; DQ invents request zero) are fixed in live `exports.js`, `dataQuality.js`, `reconciliation.js`.

### Minor

_None that qualify as residual defects._ Thin DQ/recon cards (`orphanedRequests` / `phase8Linked` null stubs) and thin AdminShell hubs match documented Wave 4 / WITH_BLOCKERS scope — not regressions from the fix wave.

---

## Assessment

**Approved**

Prior Critical + Important findings verified remediated in live code. Spot-checks (metrics gate, foundations broken≠COMPLETED, Phase 19 pack, exit decision) hold. No residual Critical or Important defects.
