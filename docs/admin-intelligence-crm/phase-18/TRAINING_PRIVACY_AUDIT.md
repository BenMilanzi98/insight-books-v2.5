# Training Privacy Audit

**Audited:** 2026-07-31

| Concern | Current | Class | Wave |
|---------|---------|-------|------|
| Participant PII in list/search | No Participant plane | CONTACT_PRIVACY_RISK when built | 2–4 |
| Assessment answers in list/export | Absent | FORBIDDEN if leaked | 3–4 |
| Meeting join tokens in aggregates/cache | Meeting exists; Training cache absent | FILE_SECURITY_RISK / CONTACT_PRIVACY_RISK | 2–4 |
| Restricted materials download | Absent | FILE_SECURITY_RISK | 2 |
| Anonymous feedback deanonymisation | Absent | CONTACT_PRIVACY_RISK | 4 |
| Credentials in materials/notes/exports | Forbidden by design; no Training export yet | FORBIDDEN | All |
| Cross-Tenant Program access | No Program; CRM scope stub | CROSS_TENANT_RISK | 1–4 |
| Portfolio-scoped My Work | Absent | CUSTOMER_PORTFOLIO_RISK | 4 |
| Practice env Production data | Absent | FORBIDDEN | 2 |
| Cache keys omit answers/tokens/restricted | Absent | CONTACT_PRIVACY_RISK | 4 |

**Disposition:** Fail-closed projections; strip answers/tokens/credentials; portfolio/Tenant isolation; never cache restricted payloads in broad aggregates.
