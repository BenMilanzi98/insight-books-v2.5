# Phase 15 Implementation Plan (pointer)

**Authoritative plan:** [`docs/superpowers/plans/2026-07-31-commercial-documents-phase-15.md`](../../superpowers/plans/2026-07-31-commercial-documents-phase-15.md)

**Design:** [`docs/superpowers/specs/2026-07-31-commercial-documents-phase-15-design.md`](../../superpowers/specs/2026-07-31-commercial-documents-phase-15-design.md)

| Wave | Deliverable | Gap IDs |
|------|-------------|---------|
| 0 | This forensic pack (done 2026-07-31) | — |
| 1 | Proposal Request + CrmCommercialDocument spine + Proposal/Quotation + numbering/versioning/status + Demo/Opp convert idempotency + thin API/UI stubs | G15-01…06, G15-23, G15-27 |
| 2 | Price Books + product config/line items + pricing/tax/FX + discounts/exceptions + terms/clauses + approval engine + SoD | G15-07…13, G15-24 |
| 3 | Templates/branding + PDF/checksum/storage + issue/delivery/review + acceptance/rejection + expiry/supersession + e-sign boundary NOT_CONFIGURED | G15-14…19 |
| 4 | Commercial hubs + reports/exports/schedules + DQ/recon/reliability + Closed-Won readiness + Phase 16 handoff pack + Opp/Demo/Account extensions | G15-20…22, G15-25–26, G15-29 |

**Expected phase exit (Wave 4):** `READY_FOR_PHASE_16_WITH_BLOCKERS`  
(E-sign provider, scope harden, weighted UI, Demo cloud/recording, telephony, calendar sync may remain deferred)

**Execution:** User chooses Subagent-Driven or Inline after Wave 0 GO. **No application code in Wave 0.**  
**Skip:** `PHASE_16_INPUTS.md` / Wave 4 exit pack until Wave 4.
