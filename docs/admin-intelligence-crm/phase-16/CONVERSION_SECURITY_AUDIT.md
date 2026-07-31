# Conversion Security Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Conversion FLS / SoD | NOT_FOUND | Design: request vs approve vs execute |
| CRM authz | FOUNDATION / CROSS_TENANT_RISK | `resolveCrmScope` stub `mode: 'all'` |
| Admin Tenant create auth | FOUNDATION | Admin session required |
| Platform billing auth | FOUNDATION | Admin permissions |
| Cross-tenant Business/Branch deny | NOT_FOUND | Wave 2 test required |
| AI provisioning | FORBIDDEN / absent | — |
| System CoA admin | CORRECT_AND_REUSABLE removed | Stays removed |

**Implication:** Wave 1+ enforce SoD + scope; never grant platform Super Admin to Tenant users.
