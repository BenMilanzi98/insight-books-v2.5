# Current Tax Calculation Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CRM commercial tax rules / rate versions | NOT_FOUND | No tax logic under `lib/admin/crm` |
| Tenant taxCalculationService | WRONG_DOMAIN / TAX_RISK | `lib/taxCalculationService.js` — TaxType %/fixed + GL posting path |
| Tenant QuotationItemTax | WRONG_DOMAIN | Prisma `QuotationItemTax` |
| invoiceCalculations tax helpers | WRONG_DOMAIN | Invoice/quote helpers |
| MRA EIS fiscal submission from quotes | FORBIDDEN | Must not occur from CRM commercial docs |
| Tax override approval on CRM docs | NOT_FOUND | — |

**Implication:** Wave 2 in-platform commercial tax (document context, categories, rate versions). No Tenant GL postings; no MRA EIS fiscal from quotations.
