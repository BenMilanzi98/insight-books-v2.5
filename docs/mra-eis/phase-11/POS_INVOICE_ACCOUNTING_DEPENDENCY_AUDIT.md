# POS / Invoice / Accounting Dependency Audit

| Path | Classification | Notes |
|---|---|---|
| `POST /api/sales` `$transaction` | CANONICAL | Sale + inventory + Payment + `createSaleJournalEntries` |
| `app/pos/page.js` completeSale | CANONICAL UI | In-flight ref only; server is authority |
| Legacy `eisService.submitInvoice` post-commit | LEGACY / UNSAFE | **Replaced** by Phase 11 bridge (no MRA call) |
| `POST /api/invoices` non-Draft | CANONICAL | Stock + `createInvoiceJournalEntry` + Phase 11 bridge |
| `PUT /api/invoices/[id]` Draft→issued | CANONICAL | Journals + Phase 11 bridge |
| Quotation convert | CANONICAL issue path | Bridge attached; quote itself never bridged |
| `POST /api/payments` | NOT_APPLICABLE | Customer collection — no Sale bridge |
| Receipt reprint / email | NOT_APPLICABLE | Not finalization identity |
| POS void before complete | NOT_APPLICABLE | Pre-finalization |
| Credit note / refund | BLOCKED (future) | Correction boundary |

---
*Phase 11 implementation. Local sales eligibility + bridge only. No MRA Sale submission, fiscal number, QR, or “MRA validated” receipt. Bridge creates no Journal/Stock Movement. Customer payments are not Sales. Draft/Quote/Proforma excluded.*
