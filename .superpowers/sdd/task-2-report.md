# Task 2 Report: Reverse orchestrator

**Status:** DONE  
**Date:** 2026-08-11  
**Commits:** none (WORKING_TREE)

## Summary

Implemented transactional booking reversal for draft, unpaid posted, paid, completed, missing, and already-cancelled rental transactions. The cancel API now delegates to the service, the rentals UI exposes **Reverse** for open bookings, and paid-invoice reversals direct operators to refund or credit the invoice first.

## TDD Evidence

### RED

```bash
npx vitest run test/rentalReverseService.test.js
```

Result: **FAIL** — `Cannot find module '../lib/rentalReverseService.js'`.

### GREEN

```bash
npx vitest run test/rentalReverseService.test.js test/rentalSourceTags.test.js test/rentalAvailability.test.js
```

Result: **PASS** — 3 files, 14 tests, 0 failures.

## Files Changed

| File | Action | Purpose |
|---|---|---|
| `lib/rentalReverseService.js` | Created | Reversal orchestration, availability release, asset restock, invoice unwind, and audit log |
| `lib/invoiceVoidService.js` | Created | Shared invoice void update/audit helper plus posted-invoice GL reversal adapter |
| `test/rentalReverseService.test.js` | Created | Unit coverage for not found, idempotent, paid, completed, draft, and posted-unpaid paths |
| `app/api/rentals/cancel/route.js` | Modified | Delegates reversal and maps domain codes to HTTP 404/409/400 |
| `app/api/invoices/void/route.js` | Modified | Uses the shared in-transaction invoice void helper |
| `app/rentals/RentalsClient.js` | Modified | Replaces draft-only cancel control with Reverse and payment-specific 409 guidance |

## Behaviour

- Draft/missing invoice: deletes any draft invoice, clears `invoiceId`, marks the rental transaction cancelled.
- Posted unpaid invoice: voids the invoice, keeps `invoiceId` for reports, then marks the transaction cancelled.
- Completed payments: returns `NEED_CREDIT_REFUND` before availability or asset status changes.
- Completed booking: returns `CLOSED`.
- Cancelled booking: safe idempotent success.
- Reversal deletes availability rows; only space/rental assets are explicitly returned to `available`.
- `RENTAL_BOOKING_REVERSED` audit details include the source resolved by `resolveOutboundInvoiceSource`.

## Verification

- Focused rental tests: **14 passing**.
- IDE diagnostics: no errors on all touched files.
- `git diff --check`: passed (only an existing LF→CRLF warning).
- Targeted ESLint process produced no output and did not finish after 84 seconds, so it was stopped; this is non-blocking because IDE diagnostics were clean.

## Concerns

The V2 journal reversal keeps the invoice route's established independent posting boundary. If a later database mutation fails after journals reverse, operator recovery may be required; this pre-existing transactional boundary is preserved rather than changed in this task.
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

---

## Task 2 Review Fixes (2026-08-11)

**Status:** PASS — Critical/Important findings addressed; no commit created.

- `voidPostedInvoice` now calls `assertPeriodOpen(tenantId, voidDate, db)` before GL or invoice writes, so a locked period fails with the accounting-period service's clear error.
- It passes the rental transaction client as `db` to `reverseSourceJournals`; the V2 posting boundary joins that client, so journal reversals roll back with the invoice, availability, and booking updates.
- Added helper coverage proving the shared transaction is used and locked periods stop before journal/invoice work; rental coverage proves a locked-period void failure leaves stock and the booking untouched.

**Verification**

```bash
npx vitest run test/invoiceVoidService.test.js test/rentalReverseService.test.js
# PASS — 2 files, 9 tests

npx vitest run test/rentalReverseService.test.js
# PASS — 1 file, 7 tests
```
