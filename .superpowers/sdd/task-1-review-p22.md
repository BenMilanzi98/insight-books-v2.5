# Task 1 Review — Phase 22 Wave 1 Handoff validate/accept + Request/Program spine

**Reviewer:** SDD review subagent  
**Date:** 2026-07-31  
**Mode:** READ-ONLY (this review file only)  
**BASE_SHA:** `7d9709a897bc0d4609ce8a6725aad7d9cf1cb835` (WORKING_TREE; `lib/admin/customerSuccess/training/**` + Wave1 test untracked vs HEAD)  
**Scope (LIVE):** `lib/admin/customerSuccess/training/{handoffConsume,requests,programs,programAccess,status,numbering,catalogue,index}.js`; `test/systemAdmin.cs.trainingPhase22Wave1.test.js`  
**Spec / plan:** design §§4–7; plan Task 1  
**Vitest (LIVE):** `npx vitest run test/systemAdmin.cs.trainingPhase22Wave1.test.js test/systemAdmin.cs.trainingWave1.test.js` → **22/22 PASS** (Wave1 12/12 + regression 10/10)

## Focus checklist (LIVE)

| Focus | Result |
|-------|--------|
| Checksum validate | **PASS** — `evaluatePhase22TrainingHandoffChecksum` + `validateTrainingHandoff`; emit SoT `computePhase22TrainingHandoffChecksum`; missing → UNKNOWN; mismatch → INVALID |
| UNKNOWN ≠ VALID | **PASS** — missing checksum never VALID; accept refuses UNKNOWN and does not mark `ACCEPTED_BY_TRAINING` / create TRQ |
| Accept idempotent | **PASS** — exact retry same Request; same key + different handoff → `idempotency_conflict`; SUPERSEDED refused |
| Correction/supersession history | **PASS** — accept preserves `supersessionHistory` / prior SUPERSEDED payload; does not invent Sessions/certs |
| Request / Program spine | **PASS** — accept → TRQ `PHASE_21_TRAINING_HANDOFF`; Program only after Request ACCEPTED; `TRN-`; curriculum pin; accept alone `programCreated: false` |
| Duplicate active purpose | **PASS** — blocked on `acceptTrainingHandoff` (before TRQ / `ACCEPTED_BY_TRAINING`) and `createCustomerTrainingProgram` via `findActiveProgramForPurpose` → `duplicate_active_program_purpose` |
| Source / catalogue | **PASS** — `PHASE_21_TRAINING_HANDOFF` primary; PHASE_16/17 aliases via `resolveTrainingRequestSource`; `phase: 22`, `treePhaseAlias: 18`, `wave: 1` |
| Portfolio / scope fail-closed | **PASS** — `assertTrainingTenantInPortfolioScope` gates accept + Program create; scoped CS denied outside portfolio |
| Invalid transitions | **PASS** — Request NEW→CONVERTED_TO_PROGRAM and Program DRAFT→COMPLETED throw `invalid_status_transition` |
| No Sessions/attendance/certs this wave | **PASS** — accept/create flags + Wave1 tests; no new delivery/cert invent path in Task 1 |
| Vitest honesty | **PASS** — report 12+10 matches LIVE re-run 22/22 |

## Issues

### Critical

None.

### Important

None remaining. Prior Important #1/#2 **FIXED** (see `.superpowers/sdd/task-1-fix-report-p22.md`):

1. ~~`acceptTrainingHandoff` omits Spec §6 duplicate active Program purpose check~~ — **FIXED**: `findActiveProgramForPurpose` before Request create; Wave1 asserts no new TRQ / no `ACCEPTED_BY_TRAINING`.
2. ~~Accept (and Program create) omit portfolio/permission scope fail-closed~~ — **FIXED**: `assertTrainingTenantInPortfolioScope` on accept + Program create; Wave1 scoped-deny coverage.

### Minor

1. **Accept `acceptInputHash` stored but not compared on same-key replay** — same as Phase 21 note: same key + same handoff treated as exact retry even if `acceptanceNotes` differ. Request/Program `inputHash` conflict still works for spine creates.
2. **`createCustomerTrainingProgram` has no `handoffId` entry alias** — Spec §7 allows `handoffId | trainingRequestId`; Wave1 only exercises Request id (acceptable spine path).
3. **Stale Phase 18 headers / contract flags** — `programs.js` / `status.js` still say “Phase 18 Wave 1”; `TRAINING_DOMAIN_CONTRACT.sessionsDeferred/attendanceDeferred/assessmentsDeferred: false` while Wave 1 correctly does not harden those surfaces (pre-existing tree modules — honesty polish only).

## Assessment

**Approved for Task 2**

Wave 1 checksum/UNKNOWN, idempotent accept, source retarget, TRN Program-after-accept, Spec §6 duplicate purpose on accept, portfolio fail-closed on writes-by-id, status machine, and Vitest claims are solid. Minors remain non-blocking polish.

**Ready for Task 2?** yes

---

## Post-fix re-review (2026-07-31)

**Verdict:** Important #1 and #2 verified fixed in code + Wave1 tests. Re-ran Vitest → **22/22 PASS**. No new Critical/Important. Minors unchanged (non-blocking).

**Ready for Task 2?** yes  
**Path:** `.superpowers/sdd/task-1-review-p22.md`
