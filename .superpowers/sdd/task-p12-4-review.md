# Task P12-4 Review — Wave 4 Extra Pipelines + duplicates/merge + import + reports + Phase 13 pack

**Head:** `WORKING_TREE` (no commit, per brief)  
**Diff:** `.superpowers/sdd/task-p12-4-review-package.diff` (~4770 lines) + Important fix follow-ups in working tree  
**Brief / report:** `task-p12-4-brief.md` / `task-p12-4-report.md`  
**Mode:** Read-only (spec compliance + code quality)  
**Date:** 2026-07-30  

---

## RE-REVIEW (Important fixes)

**Prior verdict:** Needs fixes (terminal CLOSED_* import; EXPANSION `accountId` not required)  
**Re-review focus:** `lib/admin/crm/opportunities/import.js` + Wave 4 tests  
**Vitest (re-run):** `npx vitest run test/systemAdmin.crm.opportunityWave4.test.js` — **14/14 passed**

### Prior Important #1 — Import terminal CLOSED_* stages

| Check | Result |
|-------|--------|
| Reject `CLOSED_WON` / `CLOSED_LOST` | ✅ `validateOpportunityImportRow` uses `CRM_PIPELINE_TERMINAL_STAGES` → `TERMINAL_STAGE_USE_CLOSE_SERVICE` |
| Confirm path fail-closed | ✅ `confirmOpportunityImport` gates on preview `invalid > 0` → `IMPORT_VALIDATION_FAILED`; no rows written |
| Status remains OPEN-only for allowed stages | ✅ Create path still hardcodes `status: OPEN` but terminals never reach create |
| Wave 4 test | ✅ `rejects terminal CLOSED_WON / CLOSED_LOST stages (use close service)` — preview + confirm |

### Prior Important #2 — EXPANSION `accountId` required

| Check | Result |
|-------|--------|
| Fail closed without `accountId` | ✅ `pipelineCode === EXPANSION && !accountId` → `EXPANSION_ACCOUNT_REQUIRED` |
| Aligns with catalogue `existing_account` | ✅ Matches EXPANSION first-stage `entryCriteria` in `definitions.js` |
| Valid with account | ✅ Preview accepts EXPANSION + `accountId` |
| Wave 4 test | ✅ `rejects EXPANSION import without accountId (existing_account)` |
| MRA_EIS `contactId` | ✅ Intentionally not required on import (prior optional note); confirm still allows MRA_EIS without account/contact |

**Re-review findings:** No new Critical/Important defects on the two fix paths. Prior Minor items remain residual (not re-blocking).

---

### Spec Compliance

- ✅ **EXPANSION + MRA_EIS ACTIVE in catalogue** — `definitions.js` + `catalogue.js` versioned ACTIVE defs; `listPipelines` always surfaces all three codes; SQL seeds `CrmPipeline` + `CrmPipelineVersion` (idempotent). Entry criteria documented (`existing_account` / `mra_eis_context`).
- ✅ **Opportunity duplicates + no auto-merge** — `duplicates.js` SAME_ACCOUNT / SAME_HANDOFF_KEY / OVERLAPPING_COMMERCIAL; review never merges; API detect/list/review; `meta.autoMerge: false`.
- ✅ **Opportunity merge SoD** — `merge.js` request → approve → execute; `requester !== approver` on approve (`SOD_VIOLATION`); evidence JSON; loser → `MERGED` + `mergedIntoOpportunityId`; no silent/auto merge; `provisioned: false`.
- ✅ **Import honesty + idempotency** — preview/confirm; `importIdempotencyKey`; `successRate: null`; currency/basis required when amount present; invalid pipeline/stage fail-closed; terminal stages rejected; EXPANSION requires `accountId`; `provisioned: false`.
- ✅ **Reports currency-separated; no false zeroes; weighted dark** — EMPTY/UNAVAILABLE null envelopes; `summarizeAmountsByCurrency` no FX rollup; `WEIGHTED_PIPELINE_UI_ENABLED === false`; weightedTotals `NOT_AVAILABLE` when dark; schedules audited via run rows.
- ✅ **Closed Won / import never provisions** — no Tenant/Subscription/Invoice create in Wave 4 paths; import/merge return `provisioned: false`.
- ✅ **Phase 13 pack + exit** — `FINAL_PHASE_12_REPORT.md` / `PHASE_13_INPUTS.md` / `PHASE_13_READINESS_CHECKLIST.md`; decision **READY_FOR_PHASE_13_WITH_BLOCKERS**.
- ✅ **Foundations honesty** — IMPORT / REPORTING / OPPORTUNITY_PIPELINE → READY; Email/WhatsApp NOT_AVAILABLE; weighted dark.
- ✅ **Vitest Wave 4 suite** — exists; report claims PASS; re-run confirmed **14/14**.
- ✅ **No git commit** — WORKING_TREE per brief/report.

---

### Hard rules

| # | Rule | Status |
|---|------|--------|
| 1 | EXPANSION + MRA_EIS ACTIVE in catalogue | ✅ Pass |
| 2 | Opportunity merge SoD (requester ≠ approver); no silent merge | ✅ Pass |
| 3 | Import idempotent; no fake success rates; currency/basis required | ✅ Pass (terminals + EXPANSION account gated) |
| 4 | Reports currency-separated; no false zeroes; weighted UI/report flag OFF | ✅ Pass |
| 5 | Closed Won / import never provisions Tenant/Subscription/Invoice | ✅ Pass |
| 6 | FINAL_PHASE_12_REPORT exit READY_FOR_PHASE_13_WITH_BLOCKERS | ✅ Pass |
| 7 | Vitest Wave 4 suite exists and claims PASS | ✅ Pass (re-run green 14/14) |

---

### Acceptance checklist

| Criterion | Status | Evidence |
|-----------|--------|----------|
| EXPANSION + MRA_EIS ACTIVE (+ SQL seedable) | ✅ | Catalogue defs + SQL pipeline/version inserts |
| Duplicate candidates + SoD merge | ✅ | Detect/list/review + merge SoD test |
| Import idempotent; honesty; currency/basis | ✅ | Keys/honesty/currency + terminal reject + EXPANSION account |
| Reports currency-separated; no false zeroes; schedules audited | ✅ | EMPTY nulls; MWK/USD split; schedule run audit |
| Weighted service OK; UI/report flag OFF | ✅ | Helper works; flag false everywhere surfaced |
| FINAL + PHASE_13_INPUTS + CHECKLIST | ✅ | Under `docs/.../phase-12/` |
| Exit READY_FOR_PHASE_13_WITH_BLOCKERS | ✅ | Final report + checklist |
| Vitest PASS (Wave 4) | ✅ | 14/14 re-run |

---

### Strengths

- Catalogue always surfaces three ACTIVE pipelines even when DB is partial — matches EPERM-safe design.
- Import honesty gates (`successRate: null`, invent flags) and report EMPTY envelopes are consistent lib → API → UI → tests.
- Terminal-stage and EXPANSION account gates close the audited import bypass paths identified in the prior review.
- Merge SoD + evidence reuse Lead patterns cleanly for `OPPORTUNITY` without inventing a second merge stack.
- Weighted path correctly computes in the dark service but never enables UI/report totals.
- Phase 13 pack honestly carries blockers (weighted Phase 16, scope stub, conversion, EPERM).

---

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

_None remaining from prior review. Both Important items verified fixed._

---

### Minor (not blocking Task quality)

- SQL seeds pipeline + version only (no `CrmPipelineStage` rows for EXPANSION/MRA_EIS); runtime falls back to catalogue — acceptable under EPERM path, but DB-backed stage lists for those versions stay empty until stages are seeded.
- Merge execute remains non-transactional (report already flags; same as Phase 11 Lead merge).
- Duplicate detect scans `take: 200` peers — incomplete at scale.
- `/insightbooks/crm/duplicates` still Lead-oriented (report concern; APIs exist).
- No HTTP-level route tests for import/duplicates/reports/schedules.
- EXPANSION confirm-without-account lacks a dedicated confirm assertion (preview + shared confirm validation gate cover it; optional test hardening only).
- Review-package encoding artifacts (`ΓÇö` / `Γëá`) — packaging mojibake; on-disk sources OK.

---

### Assessment

Prior Important gaps are closed: import rejects terminal `CLOSED_*` stages with `TERMINAL_STAGE_USE_CLOSE_SERVICE` (preview + confirm), and EXPANSION without `accountId` fails with `EXPANSION_ACCOUNT_REQUIRED`. Wave 4 Vitest re-run is **14/14**. Spec compliance, hard rules, and acceptance checklist all pass. Residual Minors do not block Task quality.

**Task quality:** Approved
