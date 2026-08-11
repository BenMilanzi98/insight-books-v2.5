# Task 3 Report: Return linked bill ids from receipts POST

## Status

**GREEN** — POST `/api/purchases/receipts` now returns linked bill fields on success.

## Summary

After the create transaction completes, the handler looks up `SupplierBill` by `goodsReceiptId` and adds `supplierBillId`, `billNumber`, and `billStatus` to the 201 response payload.

## Changes Made

### `app/api/purchases/receipts/route.js`

1. **Added** post-transaction lookup:

```js
const linkedBill = goodsReceiptOut
  ? await prisma.supplierBill.findFirst({
      where: { tenantId: user.tenantId, goodsReceiptId: goodsReceiptOut.id },
      select: { id: true, billNumber: true, status: true },
    })
  : null;
```

2. **Extended** `responsePayload` with:
   - `supplierBillId: linkedBill?.id || null`
   - `billNumber: linkedBill?.billNumber || null`
   - `billStatus: linkedBill?.status || null`

### Unchanged

- Transaction logic, inventory posting, service PO flows, GET handler, error handling
- `return NextResponse.json({ goodsReceipt: responsePayload }, { status: 201 })`

## Self-Review

- Lookup runs **after** transaction commit, so auto-created bills from `applyGoodsReceiptInventoryPosting` are visible.
- Scoped by `tenantId` + `goodsReceiptId` — matches schema index on `SupplierBill.goodsReceiptId`.
- Null-safe when no bill exists (deferred posting, service receipts, or pre-bill edge cases).
- Fields use `|| null` so missing bills surface as JSON `null`, not `undefined`.
- No linter errors on modified file.

## Tests

- **Automated**: Not added (optional per brief).
- **Manual smoke** (not run in this session): same-day inventory receive should yield `inventoryAppliedAt` set, non-null `supplierBillId`, `billStatus === "Unpaid"`. Deferred/future-dated receipts should return null bill fields until posting runs.

## Commits

None.

## Concerns

- Service receipts that create bills via `createBillFromApprovedServicePO` (PO-level, not `goodsReceiptId`-linked) will still return null bill fields — expected; those bills are not keyed to the receipt.
- If multiple bills ever share a `goodsReceiptId`, `findFirst` returns an arbitrary match; current idempotency in `autoCreateBillFromReceipt` should prevent duplicates.
