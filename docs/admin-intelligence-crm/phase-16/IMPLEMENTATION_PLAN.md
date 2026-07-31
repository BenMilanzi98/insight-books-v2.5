# Phase 16 Implementation Plan (pointer)

**Authoritative plan:** [`docs/superpowers/plans/2026-07-31-closed-won-conversion-phase-16.md`](../../superpowers/plans/2026-07-31-closed-won-conversion-phase-16.md)

**Design:** [`docs/superpowers/specs/2026-07-31-closed-won-conversion-phase-16-design.md`](../../superpowers/specs/2026-07-31-closed-won-conversion-phase-16-design.md)

| Wave | Deliverable | Gap IDs |
|------|-------------|---------|
| 0 | This forensic pack (done 2026-07-31) | — |
| 1 | Conversion Request + readiness/dry-run/plan + orchestrator spine + step durability/idempotency/resume + Closed Won early lock + concurrency + thin API/UI stubs | G16-01…08, G16-22 (spine), G16-29, G16-32 |
| 2 | Customer match/create-link + Tenant/Business/Branch + invitations (hash-only) + isolation + accounting boundary asserts | G16-09…16, G16-27 |
| 3 | Subscription/entitlements + billing/invoice/payment boundary + activation policies | G16-17…21, G16-16 |
| 4 | CS + onboarding/training/migration/MRA handoffs + hubs/reports/DQ/recon + weighted Pipeline UI unlock + Phase 17 pack | G16-23…26, G16-28, G16-30, G16-33 |

**Expected phase exit (Wave 4):** `READY_FOR_PHASE_17_WITH_BLOCKERS`  
(E-sign provider, scope harden, optional payment provider, full onboarding/training/migration/MRA execution, rich hubs may remain deferred)

**Execution:** User chooses Subagent-Driven or Inline after Wave 0 GO. **No application code in Wave 0.**  
**Skip:** `PHASE_17_INPUTS.md` / Wave 4 exit pack until Wave 4.
