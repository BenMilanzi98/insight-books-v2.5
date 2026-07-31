# Current Revision Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CRM document versioning / revision requests | NOT_FOUND | — |
| Material change → new version | NOT_FOUND | — |
| Customer revision request comments | NOT_FOUND | — |
| Tenant quotation duplicate | WRONG_DOMAIN / REUSE_WITH_RECONCILIATION (UX only) | `app/api/quotations/[id]/duplicate` — new number; original remains mutable → DOCUMENT_IMMUTABILITY_RISK |
| Issued version immutability guard | NOT_FOUND | Wave 1 foundation flag |

**Implication:** Wave 1 version immutability foundations; Wave 3 customer revision requests.
