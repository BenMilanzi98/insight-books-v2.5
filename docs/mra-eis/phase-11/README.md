# Phase 11 — MRA EIS Sales Eligibility & Local Transaction Bridge

**Decision:** `READY_FOR_PHASE_12_WITH_BLOCKERS`

## Entry
- Domain: `lib/mraEis/application/eligibility/`
- Migration: `prisma/migrations/20260722280000_mra_eis_phase11_sales_bridge`
- Models: `MraEisEligibilityDecision`, `MraEisSalesBridge`
- APIs: `/api/mra-eis/sales-eligibility`, `/api/mra-eis/sales-bridge`
- UI: `/settings/integrations/mra-eis/sales-bridge`
- Hooks: `POST /api/sales`, `POST/PUT /api/invoices`, quotation convert
- Tests: `test/mraEis.phase11.eligibility.test.js`

## Hard rules
- No MRA API call in Phase 11
- No fiscal number / QR / MRA acceptance claim
- Bridge creates no Journal and no Stock Movement
- Draft, Quote, Proforma, Purchase, Expense, Customer Payment excluded
- Credit Sale bridged once at issue; later collections do not create a second bridge
- Split-payment and VAT5 live validation fail closed / blocked until clarified

---
*Phase 11 implementation. Local sales eligibility + bridge only. No MRA Sale submission, fiscal number, QR, or “MRA validated” receipt. Bridge creates no Journal/Stock Movement. Customer payments are not Sales. Draft/Quote/Proforma excluded.*
