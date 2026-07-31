# Quotation Domain Matrix

| Concept | Exists? | Path | Class |
|---------|---------|------|-------|
| CRM CrmQuotation | No | — | NOT_FOUND → Wave 1 |
| CRM line items + snapshot | No | — | NOT_FOUND → Wave 2 |
| Tenant Quotation | Yes | `prisma` Quotation* | WRONG_DOMAIN |
| Tenant QuotationItemTax | Yes | schema | WRONG_DOMAIN / TAX_RISK if aliased |
| Rentals Quotation | Yes | rentalV2 | WRONG_DOMAIN |
| Opp products as quote lines | Partial | `products.js` | FOUNDATION / FABRICATED_PRICE_RISK |
| Standalone vs Proposal-linked | Design | Design | CORRECT_AND_REUSABLE |
