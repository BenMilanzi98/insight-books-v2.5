# Onboarding Privacy Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Contact PII on stakeholder lists | CONTACT_PRIVACY_RISK | Stakeholder model NOT_FOUND; CRM Contacts exist — Wave 2 must project by role |
| CS portfolio scoping | EXTEND | `customerSuccess/authz.js` `resolveCsPortfolioScope` — CUSTOMER_PORTFOLIO_RISK if bypassed |
| CRM scope stub | CROSS_TENANT_RISK | `resolveCrmScope` `mode: 'all'` |
| Migration file contents in reports/search | FILE_SECURITY_RISK / FORBIDDEN | Must exclude Wave 4 search/export |
| Credentials in notes/docs | FORBIDDEN | MRA handoff forbids credential storage |
| Customer portal evidence | NOT_AVAILABLE | Typed `CUSTOMER_PORTAL_NOT_CONFIGURED` — admin attestation only |
| Cache of Contact PII in aggregates | CONTACT_PRIVACY_RISK | Wave 4 cache keys must include role projection; no PII in broad aggregates |
| Field projections (CS/Impl/Migration/MRA/Finance/Support/Exec/Auditor) | NOT_FOUND | Spec §12 — Wave 1–4 permissions |

**Disposition:** Privacy-by-projection from Wave 1 permissions skeleton; harden exports/search Wave 4.
