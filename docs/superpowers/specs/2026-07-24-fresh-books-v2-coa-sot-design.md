# Fresh-books V2 + CoA Sole Source of Truth — Design

**Date:** 2026-07-24  
**Status:** Approved for implementation  
**Strategy:** Fresh-books (no Transaction → JournalEntry migration)

## Decisions

1. **Financial SoT:** Posted `JournalEntry` / `JournalEntryLine` with `architectureVersion = ACCOUNTING_V2` only.
2. **Account SoT:** Prisma `Account` identity + `CoaV2AccountMapping` purpose resolution (`resolvePurposeAccount`).
3. **Archive:** `Transaction` / `TransactionLine` remain in DB but must not be read or written by the app.
4. **Balances:** Never use `Account.balance` or `AccountBalance` as statement/UI truth after cutover; derive from V2 ledger.
5. **Wipe:** `node scripts/fresh-books-v2-reset.js --confirm` after code cutover (zeros caches, wipes JE + V2 artifacts).

## Frozen legacy-writer inventory

### Dead helpers still called (must rewire → V2 adapters)

| Helper | Callers |
|--------|---------|
| `createSaleJournalEntries` | `app/api/sales/route.js`, `lib/historicalSalesImport/commit.js` |
| `createInvoiceJournalEntry` | `app/api/invoices/route.js`, `[id]/route.js`, `quotations/[id]/convert` |
| `createInvoicePaymentJournalEntry` | `app/api/payments/route.js`, `invoices/partial-payment` |
| `createExpenseJournalEntry` | `lib/expenseGlPosting.js` |
| `createExpensePaymentJournalEntry` | `app/api/expenses/partial-payment/route.js` |
| `autoPostTaxEntry` → `postGlEntry` | invoices, sales, quotations convert, taxCalculationService |

### Ready V2 adapters (unwired)

- `postPosSaleAccounting`, `postInvoiceAccounting`, `postExpenseAccounting`, `postCustomerPaymentAccounting`

### Live legacy writers (must quarantine)

- `lib/transactionReversalService.js`
- Invoice void/delete paths writing `Transaction`
- `app/api/purchases/payments/route.js` tax side-path
- POS cash: `lib/posCashDayService.js`, `lib/core.js` → `Account.balance` / `AccountBalance`
- `lib/capitalCoaHelpers.js` → `syncCapitalParentRollupBalance`
- `lib/journalService.js` legacy post side effects

## Target flow

Operational module → V2 adapter → `executePosting` → `JournalEntry` (ACCOUNTING_V2) → V2 ledger/reports.  
Account resolution → `resolvePurposeAccount` / entity FK to `Account.id` only.

## Out of scope

- Historical Transaction migration
- Pre-cutover P&L/BS meaning
- Full Phase 18 ops rehearsal program
