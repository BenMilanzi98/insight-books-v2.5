### Task 4: Wave 4 — Hubs, reports, DQ/recon, Closed-Won readiness, Phase 16 pack

**Depends on:** Tasks 1–3 complete (spine, pricing, issue/acceptance).

**Do NOT git commit.**

## Goal

Ship commercial overview/my-work/approvals/expiring/responses hubs (thin OK), reliability-gated metrics/reports foundations, DQ + reconciliation runners, Closed-Won readiness evaluation, Phase 16 conversion handoff (payload only — create nothing), Opp/Demo/Account commercial extensions as needed, permissions/search/cache key notes, exit docs (`FINAL_PHASE_15_REPORT`, `PHASE_16_INPUTS`, `PHASE_16_READINESS_CHECKLIST`, update `FINAL_READINESS_DECISION`). Vitest green. Expect exit **`READY_FOR_PHASE_16_WITH_BLOCKERS`** if e-sign remains NOT_CONFIGURED and core truth is solid.

## Files

Create under `lib/admin/crm/commercial/`:
- `readiness.js`, `phase16Handoff.js`, `reports.js`, `reportSchedules.js`, `dataQuality.js`, `reconciliation.js`, `metrics.js`, `reliabilityGate.js`

Also:
- `scripts/sql/crm-commercial-phase15-wave4.sql` as needed (handoff, report schedules, DQ incidents, recon runs)
- UI: commercial overview/my-work/approvals/expiring/responses (extend stubs); reports centre thin OK
- Extend Opp commercial / conversion-readiness to surface acceptance + handoff readiness without auto stage change
- Exit docs under `docs/admin-intelligence-crm/phase-15/`
- Test: `test/systemAdmin.crm.commercialWave4.test.js`

## Interfaces

```js
evaluateClosedWonReadiness({ acceptanceId }) // → NOT_READY|PARTIALLY_READY|READY|BLOCKED|HANDED_OFF
createClosedWonConversionHandoff({ actorContext, acceptanceId, idempotencyKey })
// payload only — NEVER create Customer/Tenant/Subscription/Invoice
// never mutate Opp stage/probability/close date

getCommercialMetric / report runners with reliability gate (gate fail ≠ 0)
runCommercialDataQuality / runCommercialReconciliation
```

## TDD (must cover)

- Acceptance → readiness READY when evidence complete (version+checksum+authority)
- Handoff idempotent and creates zero provisioning side effects
- Opp stage unchanged after acceptance/handoff
- Report/metric gate fail ≠ fabricated 0
- Currency-separated overview (no silent ZAR+USD sum)

## Hard rules

- Phase 16 handoff creates nothing
- Acceptance ≠ Closed Won
- Gate fail → never false zero
- E-sign limitation explicit in exit docs
- No commit

## Acceptance

- [ ] Vitest Wave 4 PASS
- [ ] Closed-Won readiness + Phase 16 handoff idempotent, no provision
- [ ] Reliability gate honesty
- [ ] Exit docs + PHASE_16_INPUTS written
- [ ] Final readiness state recorded (expect READY_FOR_PHASE_16_WITH_BLOCKERS)
- [ ] No commit

## Report

`.superpowers/sdd/task-p15-4-report.md` with RED/GREEN. Return status + test summary + concerns + path.
