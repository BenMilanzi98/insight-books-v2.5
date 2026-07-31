# Phase 18 Implementation Plan (pointer)

**Authoritative plan:** [`docs/superpowers/plans/2026-07-31-customer-training-phase-18.md`](../../superpowers/plans/2026-07-31-customer-training-phase-18.md)

**Design:** [`docs/superpowers/specs/2026-07-31-customer-training-phase-18-design.md`](../../superpowers/specs/2026-07-31-customer-training-phase-18-design.md)

| Wave | Deliverable | Gap IDs |
|------|-------------|---------|
| 0 | This forensic pack (done 2026-07-31) | — |
| 1 | Request + Program spine + numbering + state machines + handoff consume + accept/reject/convert + idempotency + seeded ACTIVE curriculum/module versions + role-module entitlement bound + permissions skeleton + thin API/UI stubs | G18-01…10, G18-39, G18-41 |
| 2 | Participants/enrolment + trainers + cohorts + Sessions↔Phase 13 + conflicts + attendance + materials/env isolation + virtual typed unavailable | G18-11…19 |
| 3 | Exercises + assessments/attempts/grading/retake/regrade + completion policy + certificates + Phase 17 typed feed + health/progress | G18-20…26 |
| 4 | UI hubs + metrics/reliability + DQ/recon/lineage + reports/exports/search/cache + Phase 8 migrate + i18n + Phase 19 pack + FINAL reports | G18-27…33 |

**Expected phase exit (Wave 4):** `READY_FOR_PHASE_19_WITH_BLOCKERS`  
(Virtual provider, recording, rich LMS authoring, portal, payment/e-sign, scope harden may remain deferred)

**Execution:** Subagent-Driven already chosen. Wave 1 may proceed after controller review of Wave 0 **CONDITIONAL GO**. **No application code in Wave 0.**  
**Skip:** `PHASE_19_INPUTS.md` / full `FINAL_PHASE_18_REPORT.md` until Wave 4 (this file's `FINAL_READINESS_DECISION.md` is Wave 0 interim only).
