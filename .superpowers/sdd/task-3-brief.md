### Task 3: Return linked bill ids from receipts POST

**Files:**
- Modify: `app/api/purchases/receipts/route.js` (POST success payload near end of handler)
- Test: extend unit coverage optionally; manual verification listed below

**Interfaces:**
- Consumes: created `goodsReceipt.id` after transaction
- Produces: response `goodsReceipt.supplierBillId`, `goodsReceipt.billNumber` (nullable when no bill yet, e.g. deferred / service)

- [ ] **Step 1: Look up auto-created bill after create**

After `goodsReceiptOut` is loaded (existing `findFirst` near the end of POST), before building `responsePayload`, add:

```js
    const linkedBill = goodsReceiptOut
      ? await prisma.supplierBill.findFirst({
          where: {
            tenantId: user.tenantId,
            goodsReceiptId: goodsReceiptOut.id,
          },
          select: { id: true, billNumber: true, status: true },
        })
      : null;
```

- [ ] **Step 2: Include bill fields on response payload**

Update `responsePayload` construction:

```js
    const responsePayload = goodsReceiptOut
      ? {
          ...goodsReceiptOut,
          receiptType: hasInventoryItems ? 'inventory' : 'service',
          deferredStockPosting:
            inventoryNotApplied && isReceiptDateStrictlyAfterTodayUTC(goodsReceiptOut.receiptDate),
          stockPostingPending: inventoryNotApplied,
          supplierBillId: linkedBill?.id || null,
          billNumber: linkedBill?.billNumber || null,
          billStatus: linkedBill?.status || null,
        }
      : result;
```

Keep `return NextResponse.json({ goodsReceipt: responsePayload }, { status: 201 });`.

- [ ] **Step 3: Smoke-check response shape**

With `npm run dev` running, after a same-day inventory receive, confirm JSON includes:

- `goodsReceipt.inventoryAppliedAt` set (stock posted)
- `goodsReceipt.supplierBillId` non-null
- `goodsReceipt.billStatus === "Unpaid"`

- [ ] **Step 4: Commit**

Skip unless the user explicitly asks to commit.

---

