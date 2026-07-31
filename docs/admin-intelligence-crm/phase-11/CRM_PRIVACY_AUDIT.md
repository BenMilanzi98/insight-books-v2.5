# CRM Privacy Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CRM PII retention policy object | NOT_FOUND | — |
| Consent / DNC before marketing | NOT_FOUND | — |
| Public form PII handling | PARTIAL | Contact form posts name/email/phone to API → email body; not stored as CRM Contact |
| Hard-coded demo inbox | PARTIAL | Operational PII in transit via SMTP |
| Tenant GL / MRA / payment secrets on Lead | FORBIDDEN | Must never attach |
| User-level product analytics on Lead UI | RESTRICTED | Requires explicit permission if ever linked |
| Support INTERNAL/RESTRICTED message leak into CRM | FORBIDDEN | Handoff consumers read links only — no message dump |
| CoA admin route | READY (removed) | Must stay removed |

**Implication:** Privacy-by-design on Crm* models; minimize PII; consent-traced; no fiscal/credential fields. Public capture must declare purpose + consent path in Wave 2+.
