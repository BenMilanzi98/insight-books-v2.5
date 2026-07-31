# Design Stub — Canonical Posting Engine

**Date:** 2026-07-25  
**Implementation:** `lib/accountingV2/engine/postingEngine.js`  
**Tag:** `COMPLETE_AND_VERIFIED` / `REUSE`

## Law

> All financial posting goes through `executePosting`. No module may write `JournalEntry` / `JournalEntryLine` directly. Legacy `postGlEntry` and retired helpers throw `LEGACY_POSTING_REMOVED`.

## API surface

| Function | Use |
|----------|-----|
| `executePosting(input, db)` | Authoritative commit |
| `previewPosting(input, db)` | Dry validate + projected lines; no registry commit |

## Adapter law

Modules call named adapters (`postExpenseAccounting`, `postInvoiceAccounting`, …) which:

1. Build `sourceReference` (`sourceModule`, `sourceType`, `sourceId`, `eventType`).  
2. Resolve accounts via purpose registry / explicit IDs.  
3. Submit via `cutoverBridge.submitViaCutover` → `executePosting`.

## Expense-specific engine expectations

| Event | Debit | Credit |
|-------|-------|--------|
| `EXPENSE_POSTED` | Expense leaf (+ VAT input if tax) | Cash/bank **or** AP if supplier+Pending |
| `EXPENSE_PAYMENT` (new) | AP or payment-clearing | Cash/bank — **never** expense leaf if recognition posted |
| Reverse | Inverse of original lines | via `reverseSourceJournals` / reversal service |

## Validation pipeline (must remain)

- Period open / posting date policy  
- Balanced debit=credit  
- Postable account (not header)  
- Tenant match  
- Idempotent registry insert  

## Out of scope for engine

- Mutating `Account.balance` as SoT  
- Rewriting historical lines on CoA merge  
- Free-form expense status (belongs in expense SM)
