# Task 4 Review — Phase 21 Wave 4 (UI/metrics/DQ/recon/Phase 22 pack/exit)

**Reviewer:** SDD review subagent (defect-first)  
**Date:** 2026-07-31  
**Mode:** READ-ONLY (this review file only)  
**Base / Head:** `7d9709a897bc0d4609ce8a6725aad7d9cf1cb835` → WORKING_TREE (no commits)  
**Brief / report:** `task-4-brief-p21.md` / `task-4-report-p21.md`  
**Vitest (LIVE re-run):** **5 files / 44 tests PASS**  
`onboardingPhase21Wave1–4` + `onboardingWave4`

---

## Spec compliance

| Focus rule | Verdict |
|------------|---------|
| Gate fail → UNAVAILABLE / `value: null` (never false zero) | ✅ `reliabilityGate` + `metrics` / overview cards; query fail → null |
| Search / export / DQ / recon portfolio fail-closed | ✅ `listScope` + empty/`failClosed` / UNAVAILABLE envelopes |
| Export `findMany` throw → UNAVAILABLE (not false-empty) | ✅ `rows/body: null`, `ok: false`, `status: UNAVAILABLE` |
| DQ request model missing ≠ invent `totalRequests: 0` | ✅ UNAVAILABLE + `totalRequests: null`; `blockingDq` stays null (not false) |
| Recon never invents `lineageIntact: true` | ✅ `lineageIntact: null` + `lineageIntactStatus: UNAVAILABLE` |
| Progress ≠ readiness ≠ completion; completion ≠ adoption | ✅ `honestyLabels.js` + `progress.js` flags + domain contract + EN/NY keys |
| Domain contract phase 21 / `treePhaseAlias` 17 | ✅ `catalogue.js` |
| Phase 22 pack honest; tree-18 Training = PRD 22 (not Adoption Phase 20) | ✅ `PHASE_22_INPUTS.md` mislabel pointer; no Training=Adoption claim |
| Exit `READY_FOR_PHASE_22_WITH_BLOCKERS` | ✅ `FINAL_READINESS_DECISION.md` + report + checklist + README |
| No Training delivery absorption; no CS folder deletes | ✅ `training.js` refuses Program/Session create; phase-17/18/19 folders present |
| Report Vitest claims honest | ✅ Live re-run matches report (44/44) |

---

## Findings

### Critical (0)

None.

### Important (0)

None. Export query-fail honesty and scoped fail-closed match Phase 19/20 remediation pattern; Wave 4 hardens cover the brief failure modes.

### Minor / notes (not blocking)

1. Search `findMany` catch still omits plane and returns `ok: true` + partial/`[]` (same CS search pattern as Phase 20) — not elevated like export UNAVAILABLE.
2. Thin Overview hub documents `getOnboardingOverviewCards` but does not wire a live fetch (intentional thin UI / WITH_BLOCKERS; matches Phase 19 Adoption note).
3. Recon overall `READY` with `lineageIntact: null` / thin instrumentation is intentional, not a success stub of `true`.
4. Scope fail-closed empty export returns `ok: true` + `rows: []` + `meta.failClosed` — distinct from query failure; correct honesty split.

---

## Assessment

**Approved**

Wave 4 hard requirements are met in code, docs, and tests. Exit `READY_FOR_PHASE_22_WITH_BLOCKERS` is recorded honestly; Phase 22 pack points Training tree-18 at FUTURE PRD 22 and explicitly rejects Adoption Phase 20 mislabel. No Critical/Important defects for Task 4.

**Counts:** Critical 0 · Important 0  
**Ready for final whole-branch review?** **yes**
