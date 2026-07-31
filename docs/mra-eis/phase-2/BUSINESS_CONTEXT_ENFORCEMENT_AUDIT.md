# Business Context Enforcement Audit

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

- Accounting V2: `assertSameBusiness` / session tenant hard-block — **strong**.
- EIS APIs: filter by `user.tenantId` — **adequate if session trusted**.
- Sales/Invoices: tenant-scoped creates — **standard**.
- Weakness: unsigned session after tenant switch; AUTHZ_AUDIT_MODE bypass for requirePermission (EIS routes often skip requirePermission).
- Jobs: cron eis-sync iterates tenants — must keep tenant isolation in each iteration.

Cross-Business IDOR: treat any missing tenantId where as CRITICAL if found in Phase 3 security tests.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
