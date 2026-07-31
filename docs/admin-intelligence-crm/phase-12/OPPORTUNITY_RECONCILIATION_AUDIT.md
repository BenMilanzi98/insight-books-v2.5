# Opportunity Reconciliation Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Opportunity recon runs | NOT_FOUND | — |
| CRM recon foundation | PARTIAL / READY pattern | `CrmReconciliationRun` + `reconciliation.js` — Lead/capture/handoff |
| Handoff READY vs Opportunity created | NOT_FOUND | Consumer absent — Wave 1+ recon seed |
| Stage history vs current stage | NOT_FOUND | — |
| Pipeline value vs Phase 6 Revenue | FORBIDDEN to equate | Recon must assert separation |
| Empty recon inventing matches | FORBIDDEN | — |

**Implication:** Wave 1+ recon: READY handoffs ↔ Opportunities (idempotency), stage consistency; never reconcile Opportunity amount into MRR.
