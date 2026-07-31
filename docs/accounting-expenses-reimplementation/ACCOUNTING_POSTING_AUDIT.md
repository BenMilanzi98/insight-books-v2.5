# Accounting Posting Audit

**Date:** 2026-07-25  
**Engine:** `lib/accountingV2/engine/postingEngine.js` → `executePosting` / `previewPosting`

## Verdict

| Concern | Tag |
|---------|-----|
| Canonical writer | `COMPLETE_AND_VERIFIED` — `executePosting` only |
| Legacy `postGlEntry` | `LEGACY_POSTING_REMOVED` — fail-closed |
| Adapter coverage (major modules) | `REUSE` / wired |
| Expense payment path | `INCORRECT_POSTING` / `DUPLICATE_POSTING_RISK` |
| Idempotency registry | `COMPLETE_AND_VERIFIED` for adapter-submitted events |
| `Account.balance` mutations | Residual risk — not financial SoT |

## Canonical path

1. Adapter builds source reference + amounts (`lib/accountingV2/adapters/*`).  
2. `submitViaCutover` (`adapters/cutoverBridge.js`) calls `executePosting`.  
3. Registry insert (`eventRegistryRepository.js`) enforces uniqueness.  
4. Journal + lines persist; outbox/audit as configured.

`lib/accountingV2/application/accountingPostingService.js` documents: all authoritative posting must use `executePosting`; `postAccountingEvent` is retired.

## Legacy fail-closed (sample)

| Legacy helper | Replacement |
|---------------|-------------|
| `createExpenseJournalEntry` | `postExpenseAccounting` |
| `createExpensePaymentJournalEntry` | V2 payment adapters (currently misrouted via `postTaxSettlementAccounting`) |
| `createSaleJournalEntries` | `postPosSaleAccounting` / COGS adapters |
| `createInvoiceJournalEntry` | `postInvoiceAccounting` |
| `autoPostTaxEntry` | taxAmount on sale/invoice/expense adapters |
| Inventory / refund / purchase legacy | matching V2 adapters |

Error code: `LEGACY_POSTING_REMOVED`.

## Expense recognition — OK

`lib/accountingV2/adapters/expenseAdapter.js` → `postExpenseAccounting`:

- Normalizes base/tax via `normalizeExpenseAmountsForGl`.  
- Credits cash (or AP when supplier + Pending).  
- Debits expense + VAT input when tax > 0.  
- Event: `AccountingEventType.EXPENSE_POSTED`, source `Expense` / expense id.

**Tag:** `EXTEND` (works; needs multi-line + preview wiring).

## Expense payment — HIGH risk

`app/api/expenses/partial-payment/route.js`:

- Creates `Payment` row and updates `paymentStatus` / `paidAmount`.  
- Calls `postTaxSettlementAccounting` (`lib/accountingV2/adapters/remainingAdapters.js`).  
- If `expense.supplierId`: debit AP — correct settlement shape.  
- **Else:** debit `expense.expenseAccountId` (expense P&L) and credit payment account.

If recognition already posted Dr Expense / Cr Cash|AP, a later cash payment that **again** debits expense double-counts opex.

**Tags:** `DUPLICATE_POSTING_RISK`, `INCORRECT_POSTING`, severity **P0** (GAP-008).

## Idempotency

`AcctV2EventRegistry` unique keys (tenant + source module/type/id + event type) — `COMPLETE_AND_VERIFIED` for engine path.  
Does **not** protect against a *different* sourceType (`ExpensePayment` vs `Expense`) that incorrectly repeats the economic debit.

## Account.balance mutations (residual)

Financial SoT is journal lines (Phase 4 comments in `lib/journalService.js`, `lib/coaAccountBalanceBreakdown.js`). Residual writers/touchers:

| Path | Note |
|------|------|
| `lib/accountBalanceService.js` | `recalculateAccountBalance*` — cache rebuild |
| Capital transfer / capital routes | May still read/align stored balance |
| `app/api/chart-of-accounts/merge/route.js` | Rewrites lines + balance aggregates |

**Tag:** `LEGACY_READ_ONLY` intent with `REFACTOR` remaining mutators.

## previewPosting

Engine exports `previewPosting` (used by opening balance / manual journal services). Expense UI/API does **not** expose it — `MISSING` product capability (GAP-010), not engine gap.
