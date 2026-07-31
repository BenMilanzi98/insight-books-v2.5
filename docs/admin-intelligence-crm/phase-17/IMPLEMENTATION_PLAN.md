# Phase 17 Implementation Plan (pointer)

**Authoritative plan:** [`docs/superpowers/plans/2026-07-31-customer-onboarding-phase-17.md`](../../superpowers/plans/2026-07-31-customer-onboarding-phase-17.md)

**Design:** [`docs/superpowers/specs/2026-07-31-customer-onboarding-phase-17-design.md`](../../superpowers/specs/2026-07-31-customer-onboarding-phase-17-design.md)

| Wave | Deliverable | Gap IDs |
|------|-------------|---------|
| 0 | This forensic pack (done 2026-07-31) | — |
| 1 | Request + Project spine + numbering + state machines + handoff consume + accept/reject/convert + idempotency + seeded STANDARD templateVersion + permissions skeleton + thin API/UI stubs | G17-01…09, G17-39, G17-41 |
| 2 | Templates/versions/approval + materialisation + kick-off (Phase 13) + stakeholders + tasks/evidence/SoD + dependencies + responsibilities + requirements/scope/CR | G17-10…17 |
| 3 | Readiness (tenant/biz/branch/user/config/accounting) + migration/MRA/training coordination + testing/defects + go-live → stabilisation → handover → completion certificate + health/progress | G17-18…27 |
| 4 | UI hubs + metrics/reliability + DQ/recon/lineage + reports/exports/search/cache + Phase 8 migrate + i18n + Phase 18 pack + FINAL reports | G17-28…34 |

**Expected phase exit (Wave 4):** `READY_FOR_PHASE_18_WITH_BLOCKERS`  
(Portal, migration engine, Training execution, payment/e-sign providers, scope harden may remain deferred)

**Execution:** Subagent-Driven already chosen. Wave 1 may proceed after controller review of Wave 0 **CONDITIONAL GO**. **No application code in Wave 0.**  
**Skip:** `PHASE_18_INPUTS.md` / full `FINAL_PHASE_17_REPORT.md` until Wave 4 (this file's `FINAL_READINESS_DECISION.md` is Wave 0 interim only).
