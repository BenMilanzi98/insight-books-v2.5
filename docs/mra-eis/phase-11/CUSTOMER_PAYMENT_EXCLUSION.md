# Customer Payment Exclusion

`assertCustomerPaymentNotFiscalSale` + architecture comment on `app/api/payments/route.js`. Payments must not import bridge create.

---
*Phase 11 implementation. Local sales eligibility + bridge only. No MRA Sale submission, fiscal number, QR, or “MRA validated” receipt. Bridge creates no Journal/Stock Movement. Customer payments are not Sales. Draft/Quote/Proforma excluded.*
