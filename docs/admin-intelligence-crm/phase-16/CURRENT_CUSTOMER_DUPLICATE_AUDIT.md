# Current Customer Duplicate Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CRM Lead/Account/Contact duplicates | FOUNDATION pattern | `lib/admin/crm/duplicates.js` |
| Opportunity duplicates | FOUNDATION pattern | `lib/admin/crm/opportunities/duplicates.js` |
| Platform Customer match engine | NOT_FOUND | No `matchPlatformCustomer` / EXACT/HIGH/POSSIBLE/CONFLICT |
| Tax/registration/domain match for conversion | NOT_FOUND | — |
| Auto-merge on similar names | FORBIDDEN / absent | Design forbids |
| Duplicate review workspace for conversion | NOT_FOUND | — |
| Skip-match risk | CUSTOMER_DUPLICATION_RISK | Admin Tenant create has no Customer identity gate |

**Implication:** Wave 2 greenfield match + duplicate-review; reuse CRM duplicate UX patterns only with reconciliation.
