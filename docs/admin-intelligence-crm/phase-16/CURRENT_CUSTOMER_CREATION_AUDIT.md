# Current Customer Creation Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Discrete PlatformCustomer model | NOT_FOUND | Identity plane uses Tenant + CustomerPortfolio / CustomerOwnership |
| CRM Account | CORRECT_AND_REUSABLE | `CrmAccount` — CRM plane ≠ Tenant |
| Customer portfolios | FOUNDATION / EXTEND | `lib/admin/customers/portfolios.js` — CS ownership |
| Conversion CREATE_OR_LINK_PLATFORM_CUSTOMER | NOT_FOUND | — |
| Handoff customerCreated honesty | CORRECT_AND_REUSABLE | `phase16Handoff.js` always `customerCreated: false` / `customerId: null` |
| Admin Tenant create as Customer | WRONG_DOMAIN / CUSTOMER_DUPLICATION_RISK | Tenant create does not mint CRM Customer / portfolio |
| Auto-create Customer from acceptance | FORBIDDEN | Not present; must stay forbidden |

**Implication:** Wave 2 define create-or-link against Tenant + Account evidence; no auto-merge.
