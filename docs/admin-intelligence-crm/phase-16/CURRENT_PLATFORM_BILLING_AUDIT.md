# Current Platform Billing Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Platform billing helpers | CORRECT_AND_REUSABLE | `lib/admin/platformBilling.js` |
| Platform billing APIs | FOUNDATION | `app/api/admin/platform-billing/**` |
| Billing Account / Schedule conversion entities | NOT_FOUND | — |
| Tenant AR as Platform Invoice | WRONG_DOMAIN | Tenant `Invoice`/`Payment` ≠ Platform |
| Deprecated admin invoices route | REUSE_WITH_RECONCILIATION | PlatformInvoice only |
| SaaS billing KPIs | FOUNDATION / WRONG_SOURCE for conversion metrics | Not conversion completion truth |

**Implication:** Wave 3 billing via platform plane only; never Tenant AR.
