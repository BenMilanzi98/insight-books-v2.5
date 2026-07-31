# Current Quotation Architecture Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CRM CrmQuotation | NOT_FOUND | No CRM quotation model/services under `lib/admin/crm` |
| QUO- numbering (CRM) | NOT_FOUND | — |
| CRM quotation UI/APIs | NOT_FOUND | No `/insightbooks/crm/quotations` |
| Tenant Quotation model | WRONG_DOMAIN | `prisma/schema.prisma` `model Quotation` — `tenantId`, client, items, tax, discount; SME AR plane |
| Tenant Quotation APIs | WRONG_DOMAIN | `app/api/quotations/**` (CRUD, send, PDF, convert, duplicate, upload) |
| Tenant Quotation UI | WRONG_DOMAIN | `app/quotations/page.js` |
| Rentals Quotation | WRONG_DOMAIN | `lib/rentalV2/quotationService.js`, `app/api/rentals-v2/quotations/**` |
| Opp commercial as Quotation | WRONG_SOURCE / FABRICATED_PRICE_RISK | Non-binding estimates only |
| Proposal readiness quotation flags | CORRECT_AND_REUSABLE | `quotationId: null`, `quotationCreated: false` honesty |
| Design lock | CORRECT_AND_REUSABLE (docs) | Tenant Quotation = WRONG_DOMAIN; new CRM CrmQuotation extension |

**Implication:** Build CRM `CrmQuotation` as typed extension of `CrmCommercialDocument`. Do **not** reuse tenant `Quotation` tables/routes as commercial truth. Optional future bridge would be explicit REUSE_WITH_RECONCILIATION — out of Wave 1 default.
