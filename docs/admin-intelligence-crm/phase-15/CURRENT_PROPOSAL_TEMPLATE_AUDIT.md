# Current Proposal Template Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CRM proposal templates / branding | NOT_FOUND | — |
| CRM email templates | EXTEND (send only) | `lib/admin/crm/emails/templates.js` — not proposal body templates |
| Activity templates | WRONG_DOMAIN | `lib/admin/crm/templates.js` |
| Tenant invoiceTemplate for quotes | WRONG_DOMAIN / REUSE_WITH_RECONCILIATION | Styling for tenant PDF — not CRM proposal template |

**Implication:** Wave 3 proposal templates under commercial domain.
