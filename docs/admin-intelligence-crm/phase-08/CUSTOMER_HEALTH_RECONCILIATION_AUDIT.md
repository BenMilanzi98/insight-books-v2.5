# Customer Health Reconciliation Audit

**Finding:** No health recon today. Phase 7 has light customer reconciliation (`lib/admin/customers/reconciliation.js`).

## Required recon checks (Wave 1)

| Check | Expected |
|-------|----------|
| Snapshot definitionVersion matches active or pinned version | Equal or flagged STALE_DEFINITION |
| Sum of used weights after renormalise | ≈ 1.0 (tolerance 1e-6) |
| Score in band thresholds for that definition | Consistent |
| Critical override applied when suspended | Band CRITICAL (or definition cap) |
| Portfolio forbidden tenant | No snapshot leak |
| Rebuild vs live evaluate | Same score/band given same asOf + definition (inputs stable) |

## Anti-patterns

- Recon that “fixes” commercial by reading Tenant Sale.
- Recon that fills missing adoption with zeroes.
