# Sales Accounting Traceability

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

POS completed → createSaleJournalEntries → posSaleAdapter → cutover posting → Journal with source Sale/`${id}-revenue`.

Invoice non-Draft → invoiceAdapter → Invoice/id/INVOICE_POSTED.

Risk: dual paths (cutover vs legacy postGlEntry fallback) — verify one authoritative journal per sale.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
