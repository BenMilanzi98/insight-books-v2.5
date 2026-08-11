# Task 2 Report: Always Unpaid in `autoCreateBillFromReceipt`

## Status

**GREEN** — Production change implemented; all unit tests pass.

## Summary

Removed GRNI-conditional Draft branching from `autoCreateBillFromReceipt` in `lib/goodsReceiptFollowOn.js`. Auto-bills from goods receipts are now always created as `Unpaid`, always finalized immediately, always attach `journalEntryId` when provided, and always increment supplier `currentBalance`.

## Changes Made

### `lib/goodsReceiptFollowOn.js`

1. **Removed** `isPurchasesGrniEnabled` import (no longer referenced anywhere in the file).
2. **Removed** GRNI gate variables (`grniEnabled`, `billStatus`, `billJournalId`).
3. **Replaced** conditional bill creation with Unpaid-always logic per product decision (2026-08-11):
   - `status: 'Unpaid'` (hard-coded)
   - `finalizedAt: new Date()` and `finalizedById: userId` (always set)
   - `journalEntryId: journalEntryId || null` (always passed through)
   - Supplier balance increment runs unconditionally after bill create

### Unchanged

- Idempotency check (returns existing bill if one exists for the receipt)
- Null return when receipt has no items
- Bill number allocation, subtotal calculation, line items mapping

## TDD Evidence

### RED (Task 1 baseline)

Task 1 added failing tests at `tests/unit/purchases/autoCreateBillFromReceipt.test.js`. The GRNI-enabled case expected `Unpaid` but production returned `Draft` and skipped balance increment.

### GREEN (Task 2)

Command:

```bash
npx vitest run tests/unit/purchases/autoCreateBillFromReceipt.test.js
```

Output:

```
 RUN  v4.1.2 C:/laragon/www/insight-books-v2.5

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  01:10:51
   Duration  2.69s (transform 159ms, setup 0ms, import 815ms, tests 28ms, environment 0ms)
```

All four test cases pass:

| Test | Result |
|------|--------|
| Creates Unpaid bill and increments supplier balance when GRNI is enabled | PASS |
| Creates Unpaid bill when GRNI is disabled | PASS |
| Returns existing bill without creating a second one | PASS |
| Returns null when receipt has no items | PASS |

## Self-Review

- **Scope**: Change limited to `autoCreateBillFromReceipt` only; no other exports modified.
- **Verbatim compliance**: Replacement block matches task brief exactly.
- **Import cleanup**: `isPurchasesGrniEnabled` removed; confirmed unused elsewhere in file.
- **Behavioral change**: GRNI-enabled tenants now get immediate Unpaid bills with AP balance impact — intentional per product decision.
- **Risk**: Downstream flows that assumed Draft auto-bills under GRNI (e.g. match/post workflows) may need separate validation in integration tests; out of scope for this task.
- **No commit**: Per instructions, changes are uncommitted.

## Commits

None.
