# Current Product Pricing Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CRM commercial line pricing service | NOT_FOUND | No `calculateCommercialDocument` |
| Opp product lines | FOUNDATION | `lib/admin/crm/opportunities/products.js` — feature/module codes or `unknownInterest`; `NON_BINDING_ESTIMATE` |
| Product catalogue prices | NOT_FOUND | `lib/admin/productCatalogue/*` — entitlements/modules/features without price fields |
| Tenant product unit prices | WRONG_DOMAIN | Tenant `Product` |
| Binding list/min price on CRM lines | NOT_FOUND | — |

**Implication:** Wave 2 binds CRM lines to Price Book entries + Phase 9 version refs. Opp product estimates remain non-binding inputs.
