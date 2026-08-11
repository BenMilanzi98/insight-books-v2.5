# Task 5 Report: Regression check — stock path still runs

## Status
**Complete** — verify-only; no code changes.

## Call order (`applyGoodsReceiptInventoryPosting.js`)

Verified inside one transaction, per receipt line then post-loop steps:

| # | Step | Location | OK |
|---|------|----------|-----|
| 1 | `createFifoBatch(...)` per line | lines 82–107 (loop) | ✓ |
| 2 | `inventoryTransaction.create` (`type: 'goods_receipt'`) | lines 110–120 (loop) | ✓ |
| 3 | `createPurchaseReceiptJournalEntry(...)` | lines 123–131 | ✓ |
| 4 | Set `inventoryAppliedAt` (+ `journalEntryId`) | lines 133–139 | ✓ |
| 5 | `autoCreateBillFromReceipt(...)` | lines 146–154 | ✓ |

- No reordering observed.
- No payment creation added (only bill follow-on).
- Early return when `inventoryAppliedAt` already set (idempotent skip at entry).

## Unit tests

```bash
npx vitest run tests/unit/purchases/autoCreateBillFromReceipt.test.js
```

**PASS** — 1 file, 4/4 tests (3.17s).

## Success criteria checklist

| Criterion | Result | Evidence |
|-----------|--------|----------|
| Stock increases on same-day receive | ✓ | `createFifoBatch` increments `Product.stockLevel` (fifoCosting.js) before journal/bill |
| Unpaid bill on Bills | ✓ | `autoCreateBillFromReceipt` creates `status: 'Unpaid'` (unit test) |
| Bill selectable on Payments | ✓ (code path) | Auto-bill creates `supplierBill` with `journalEntryId`; UI wiring is Task 3/4 — not re-tested manually here |
| Works with GRNI on | ✓ | Unit test: "creates Unpaid bill … when GRNI is enabled" |
| No payment auto-created | ✓ | `goodsReceiptFollowOn.js` creates `supplierBill` + supplier balance increment only; no `supplierPayment` / payment APIs |
| Idempotent bill | ✓ | Unit test: "returns existing bill without creating a second one" |

## Commits
None (per task constraints).

## Concerns
None. Stock posting and auto-bill coupling unchanged; call order matches spec.
