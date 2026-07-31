# Sales Transaction Type Registry

Implemented in `lib/mraEis/application/eligibility/salesTransactionTypeRegistry.js`.

Qualifying: POS_SALE, SALES_INVOICE.

Excluded: QUOTATION, ESTIMATE, PROFORMA_INVOICE, PURCHASE*, CUSTOMER_PAYMENT, EXPENSE, JOURNAL_ENTRY, OPENING_*, STOCK_*, LOAN, etc.

Correction future: CREDIT_NOTE, DEBIT_NOTE, SALE_RETURN, SALE_CANCELLATION, POS_REFUND.

Classification is structural — never by positive amount alone.

---
*Phase 11 implementation. Local sales eligibility + bridge only. No MRA Sale submission, fiscal number, QR, or “MRA validated” receipt. Bridge creates no Journal/Stock Movement. Customer payments are not Sales. Draft/Quote/Proforma excluded.*
