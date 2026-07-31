# Current Onboarding Reports Audit

**Audited:** 2026-07-31  
**Domain root:** `lib/admin/customerSuccess/onboarding/`

| Check | Class | Evidence |
|-------|-------|----------|
| Reports service | PARTIAL | `lib/admin/customerSuccess/onboarding/reports.js` |
| Reliability gate integration | PARTIAL | `lib/admin/customerSuccess/onboarding/reliabilityGate.js` — gate fail → UNAVAILABLE / null |
| Rich scheduled-report polish | CARRY | Optional WITH_BLOCKERS |
| Accepted/Closed-Won value as Revenue | FORBIDDEN | Upstream conversion labels — do not reintroduce |

**Gaps:** G21-23…G21-25 → Wave 4.
