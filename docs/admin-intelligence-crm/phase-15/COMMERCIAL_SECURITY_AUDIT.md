# Commercial Security Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CRM commercial FLS / permission matrix | NOT_FOUND | Wave 1–4 add commercial permissions |
| resolveCrmAccess opportunity/demo gates | CORRECT_AND_REUSABLE | Existing CRM access |
| resolveCrmScope stub mode:all | FOUNDATION / CROSS_TENANT_RISK | `authz.js` — holders see all; harden later |
| Public review token entropy / non-enumerable | NOT_FOUND | PUBLIC_LINK_RISK |
| Artifact private storage ACL | NOT_FOUND | — |
| Cross-plane tenant Quotation ID confusion | WRONG_DOMAIN risk | Never accept tenant quotationId as CrmQuotation id |
| Admin CRM ≠ Tenant isolation failure | CORRECT_AND_REUSABLE | Scope stub is admin-global, not multi-tenant leak of tenant DB rows into CRM |

**Implication:** Wave 1 authz on commercial services; Wave 3 secure links; document scope stub as carry.
