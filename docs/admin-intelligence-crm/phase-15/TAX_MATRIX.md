# Tax Matrix

| Capability | Exists? | Path | Class |
|------------|---------|------|-------|
| CRM commercial tax rules | No | — | NOT_FOUND → Wave 2 |
| Tax rate versions on docs | No | — | NOT_FOUND |
| Tax override + approval | No | — | NOT_FOUND |
| Tenant TaxType / taxCalculationService | Yes | lib/taxCalculationService.js | WRONG_DOMAIN / TAX_RISK |
| QuotationItemTax | Yes | prisma | WRONG_DOMAIN |
| MRA EIS fiscal from CRM quote | No | — | FORBIDDEN |
| Tenant GL tax posting from CRM | No | — | FORBIDDEN |
