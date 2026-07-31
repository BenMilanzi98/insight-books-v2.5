# Service Authorisation Audit

| Service area | Finding | Class |
|--------------|---------|-------|
| `lib/admin/*` billing KPIs | No actor check (caller must guard) | EXTEND (pass decision) |
| `paychanguLedgerBackfill` | Admin API guards at route | KEEP |
| MRA EIS adminContext | real/effective fields scaffold | EXTEND |
| `securityGovernance` | Tenant SecV2 — separate | KEEP separate |
| Platform billing helpers | Pure functions | NOT_APPLICABLE |

**Target:** Domain services accept `AdminAuthzContext`; refuse unscoped privileged operations.
