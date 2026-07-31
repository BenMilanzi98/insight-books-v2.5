# Onboarding Go-Live Matrix

| Dimension | READY requires | UNKNOWN? | Current | Class |
|-----------|----------------|----------|---------|-------|
| Customer approval | Explicit | Block | Absent | NOT_FOUND |
| Internal approval | Explicit | Block | Absent | NOT_FOUND |
| Tenant/businesses/branches/users/roles | Scope match | Block | Provision inputs only | CORRECT_AND_REUSABLE inputs |
| Entitlements / configuration | Evidence | Block | Snapshot exists | REUSE_WITH_RECONCILIATION |
| Accounting checklist | Boundary OK | Block | Boundary pattern | REUSE_WITH_RECONCILIATION |
| Migration / training / MRA | Policy + sources | Block if required | Handoffs only | CORRECT_AND_REUSABLE / UNRECONCILED |
| Testing / Critical defects | Clear or waived | Block Critical | Absent | GO_LIVE_TRUTH_RISK |
| Billing / backup / rollback / comms | Per policy | Block | Absent | NOT_FOUND |
| Outcome SUCCESSFUL | → STABILISATION | — | Absent | NOT_FOUND |
| Conversion activation ACTIVE | ≠ go-live | — | `activation.js` | WRONG_DOMAIN |
