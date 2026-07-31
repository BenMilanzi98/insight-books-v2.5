# Opportunity Security Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| `systemAdmin.crm.pipeline.view` / `.manage` | PARTIAL | Scaffold in `permissions.js`; no live Opportunity UI |
| `opportunity.*` keys | NOT_FOUND | Must add in Wave 1 |
| Owner / team / territory scope | PARTIAL | `resolveCrmScope` still stub `mode: 'all'` (Phase 11 carry) |
| Stage transition authz | NOT_FOUND | Server service Wave 1 |
| Closed Won SoD / evidence | NOT_FOUND | Wave 3 |
| Merge SoD pattern | CORRECT_AND_REUSABLE | Lead merge requester ≠ approver — reuse for Opportunity merge |
| Authorize via Tenant POS `sales.*` | FORBIDDEN | — |
| analytics-pipeline health permission as Pipeline | WRONG_DOMAIN | `health.view` on analytics-pipeline route |
| CoA admin / payment secrets | FORBIDDEN | Stays removed / unexposed |

**Implication:** Wave 1 live pipeline + opportunity permissions + transition authz. Carry scope hardening. Never authorize CRM Pipeline via POS or analytics health keys.
