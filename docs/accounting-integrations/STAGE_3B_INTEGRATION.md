# Stage 3B Integration — Credit Notes & Customer Refunds

## Wired

| Adapter | Event | Entry |
| --- | --- | --- |
| `creditNoteAdapter` | `CUSTOMER_CREDIT_NOTE_POSTED` | `createCreditNoteJournalEntry` |
| `customerRefundAdapter` | `CUSTOMER_REFUND_POSTED` | `createInvoiceRefundJournalEntry` ← `app/api/invoices/refund` |

## Refund bypass shutdown

Previously `app/api/invoices/refund/route.js` wrote `Transaction` + balance
updates directly (`sourceType: InvoiceRefund`), skipping `postGlEntry` and the
legacy guard. That path now uses `createInvoiceRefundJournalEntry` →
`postGlEntry` / cutover. `invoiceRefund.transactionId` stores the GL id.

## Templates

ACTIVE v2: `CUSTOMER_CREDIT_NOTE`, `CUSTOMER_REFUND`.

## Still scaffolded

POS cash deposit, supplier credits, payroll, assets, loans, equity.

## Note

POS sale refund (`app/api/sales/[id]/refund`) uses
`reverseSaleGlForRefundInTx` (reversal path), not this invoice-refund adapter.
