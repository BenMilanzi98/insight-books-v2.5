# Demo Reconciliation Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Demo recon service | NOT_FOUND | No demos reconciliation |
| Activity recon pattern | CORRECT_AND_REUSABLE pattern | `activities/reconciliation.js` |
| CRM recon API | FOUNDATION pattern | `/api/admin/crm/reconciliation` |
| Demo ↔ Meeting time reconcile | NOT_FOUND (required Wave 1) | Design: Demo times must match linked Meeting/Calendar |
| Demo ↔ Opportunity projection reconcile | NOT_FOUND | Wave 1 projections |
| Env provision state recon | NOT_FOUND | Wave 3 idempotent provision/reset |
| Gate fail → invent zeroes | FORBIDDEN | Preserve EMPTY/UNAVAILABLE |

**Implication:** Wave 1+ recon checks for Meeting link integrity; Wave 3 env state; Wave 4 delivery/attendance honesty.
