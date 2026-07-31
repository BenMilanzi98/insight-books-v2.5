# Task 3 Report — Phase 21 Wave 3 Go-live / completion / CS handover / Phase 22 Training handoff

**Status:** COMPLETE  
**Date:** 2026-07-31  
**Gaps closed:** G21-15 … G21-22  
**Git commit:** none (per brief)

## Deliverables

| Item | Result |
|------|--------|
| Go-live readiness | UNKNOWN ≠ READY; Critical/High open defects block approve/decision/schedule/execute |
| Decision SoD | `recordGoLiveDecision` — executor ≠ decision recorder when decision present |
| Schedule ≠ execute | `scheduleGoLive` → SCHEDULED only; not SUCCESSFUL; does not satisfy completion |
| Rollback evidence | `ROLLED_BACK` updates row + `rollbackDecision`; never deletes go-live evidence |
| Cutover | `cutover.js` — coordination distinct from go-live success |
| Completion chain | Requires go-live SUCCESSFUL + stabilisation EXITED + Customer/internal sign-off + CS handover ACCEPTED + recon |
| Certificate | Checksum idempotent; `COMPLETED_WITH_GAPS` explicit when open gaps |
| CS handover | Checksum + idempotent; `assertHandoverDoesNotOverwriteCustomerHealth`; no Customer Health writes |
| Phase 22 Training handoff | `emitPhase22TrainingHandoff` checksum/idempotent; never Programs/Sessions/attendance/certs |
| Training coord | COMPLETED still requires Training-domain source (Phase 22 / Training domain) |
| Stabilisation | Distinct from Phase 35 hypercare (`hypercare: false`) |
| Vitest Wave 3 | `test/systemAdmin.cs.onboardingPhase21Wave3.test.js` **10/10 PASS** |
| Regression Waves 1–2 | Wave1 **10/10**, Wave2 **9/9** PASS |
| Tree Wave 3 compat | `test/systemAdmin.cs.onboardingWave3.test.js` **18/18 PASS** |
| Combined | Phase21 W1–3 + tree W3 **47/47 PASS** |

## Key files

- `lib/admin/customerSuccess/onboarding/goLive.js`
- `lib/admin/customerSuccess/onboarding/cutover.js`
- `lib/admin/customerSuccess/onboarding/stabilisation.js`
- `lib/admin/customerSuccess/onboarding/completion.js`
- `lib/admin/customerSuccess/onboarding/handover.js`
- `lib/admin/customerSuccess/onboarding/training.js`
- `lib/admin/customerSuccess/onboarding/defects.js`
- `lib/admin/customerSuccess/onboarding/readiness/evaluate.js`
- `lib/admin/customerSuccess/onboarding/catalogue.js`
- `lib/admin/customerSuccess/onboarding/model.js`
- `lib/admin/customerSuccess/onboarding/status.js`
- `lib/admin/customerSuccess/onboarding/index.js`
- `test/systemAdmin.cs.onboardingPhase21Wave3.test.js`

## Honesty preserved

- UNKNOWN readiness never treated as READY for decision/approve/schedule/execute.
- Critical and High open defects block go-live (approve/decision/schedule/execute/**SUCCESSFUL outcome**).
- Schedule alone ≠ SUCCESSFUL outcome ≠ completion (SUCCESSFUL requires IN_PROGRESS evidence post-execute).
- Executable GO / GO_WITH_CONDITIONS decision required before schedule/execute; SoD executor ≠ recorder.
- Rollback preserves go-live evidence rows.
- Completion requires full evidence chain; go-live alone insufficient.
- COMPLETED_WITH_GAPS is explicit (not silent COMPLETED).
- CS handover does not mutate Customer Health; idempotencyKey required.
- Phase 22 Training handoff is package-only; no Training delivery artifacts.
- Stabilisation EXITED requires prior record + exit criteria (or audited waiver).
- `dimensionOverrides` ignored on go-live APIs unless `allowDimensionOverrides` harness flag.

## Stop / next

SDD review gate before Wave 4 (UI/metrics/DQ/recon/Phase 22 pack/exit).

---

## Review fix pass (2026-07-31)

Addressed Critical + blocking Important from `task-3-review-p21.md`:

| Issue | Fix |
|-------|-----|
| Critical: SUCCESSFUL from SCHEDULED | `recordGoLiveOutcome('SUCCESSFUL')` requires go-live `IN_PROGRESS`; rejects schedule-alone; re-checks readiness + Critical/High defects |
| Important #5: null goLive → STABILISATION | Refuse SUCCESSFUL without go-live evidence row; no project advance |
| Important #1: SoD bypass by omitting decision | `requireExecutableDecision` on schedule/execute |
| Important #2: invent EXITED | `approveStabilisationExit` requires prior record + exit criteria met / audited waiver |
| Important #3: dimensionOverrides seam | Ignored unless `allowDimensionOverrides: true` |
| Important #4: silent go-live waiver on cert | Certificate path sets `certificateIssuance`; waiver needs `allowGoLiveWaiverForCertificate` |
| Minor: handover idempotencyKey | Now required |
| Minor: latest decision | Sorted by decidedAt/createdAt desc |
| Minor: completion header | Phase 21 |

**Vitest after fix:** Phase21 W1–3 **30/30** (W3 **11/11**) + tree W3 **18/18** → **48/48 PASS**  
**Re-fix:** `.superpowers/sdd/task-3-fix-report-p21.md`
