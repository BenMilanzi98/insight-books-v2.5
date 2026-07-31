# Legacy Sales Bridge Migration Plan

| Hook | Class | Action |
|---|---|---|
| `lib/eisService.js` submit from sales/invoices/quotations | DIRECT_EXTERNAL_CALL_UNSAFE | Disabled on those paths — Phase 11 bridge instead |
| `EISInvoice` / validationUrl fields | LEGACY_STATUS_FIELD | Retain read-only; do not treat as MRA acceptance |
| QR / fiscal id fields | LEGACY_FISCAL_ID | Not written by Phase 11 |

---
*Phase 11 implementation. Local sales eligibility + bridge only. No MRA Sale submission, fiscal number, QR, or “MRA validated” receipt. Bridge creates no Journal/Stock Movement. Customer payments are not Sales. Draft/Quote/Proforma excluded.*
