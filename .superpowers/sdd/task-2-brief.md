### Task 2: Always Unpaid in `autoCreateBillFromReceipt`

**Files:**
- Modify: `lib/goodsReceiptFollowOn.js` (function `autoCreateBillFromReceipt`)
- Test: `tests/unit/purchases/autoCreateBillFromReceipt.test.js`

**Interfaces:**
- Consumes: same function signature as today
- Produces: always `status: 'Unpaid'`, always balance increment on create, always attach `journalEntryId` when provided

- [ ] **Step 1: Replace GRNI Draft branching with Unpaid-always**

In `lib/goodsReceiptFollowOn.js`, inside `autoCreateBillFromReceipt`, remove the Draft/GRNI gate for status, journal, finalize, and balance.

Replace this block:

```js
  const billNumber = await allocateGoodsReceiptBillNumber(tx, goodsReceipt);
  const grniEnabled = await isPurchasesGrniEnabled(tx, tenantId);

  // GRNI mode: receipt already accrued inventory vs GRNI. Auto-bill is a draft
  // payable document awaiting supplier invoice / match / post — do not share the
  // receipt journal or inflate supplier AP balance until the bill posts.
  const billStatus = grniEnabled ? 'Draft' : 'Unpaid';
  const billJournalId = grniEnabled ? null : journalEntryId || null;

  const bill = await tx.supplierBill.create({
    data: {
      // ...
      status: billStatus,
      // ...
      finalizedAt: grniEnabled ? null : new Date(),
      finalizedById: grniEnabled ? null : userId,
      journalEntryId: billJournalId,
      // ...
    }
  });

  if (!grniEnabled) {
    await tx.supplier.update({
      where: { id: supplier.id },
      data: {
        currentBalance: {
          increment: subtotal
        }
      }
    });
  }
```

With:

```js
  const billNumber = await allocateGoodsReceiptBillNumber(tx, goodsReceipt);

  // Product decision (2026-08-11): auto-bill from goods receipt is always Unpaid
  // and immediately payable, even when purchases GRNI is enabled.
  const bill = await tx.supplierBill.create({
    data: {
      tenantId,
      supplierId: supplier.id,
      purchaseOrderId:
        goodsReceipt.purchaseOrderId || purchaseOrder?.id || null,
      goodsReceiptId: goodsReceipt.id,
      billNumber,
      billDate,
      dueDate,
      billType: 'inventory',
      supplierInvoiceNumber: goodsReceipt.supplierReference || null,
      subtotal,
      taxAmount: 0,
      totalAmount: subtotal,
      amountPaid: 0,
      status: 'Unpaid',
      paymentTerms,
      currency: supplier.currency || 'MWK',
      notes: goodsReceipt.notes || null,
      createdById: userId,
      finalizedAt: new Date(),
      finalizedById: userId,
      journalEntryId: journalEntryId || null,
      items: {
        create: goodsReceipt.items.map((item, index) => ({
          lineNumber: index + 1,
          productId: item.productId,
          description: item.notes || '',
          quantity: Number(item.quantityReceived || 0),
          unitCost: Number(item.unitCost || 0),
          lineTotal:
            Number(item.quantityReceived || 0) * Number(item.unitCost || 0),
          taxRate: 0,
          taxAmount: 0
        }))
      }
    }
  });

  await tx.supplier.update({
    where: { id: supplier.id },
    data: {
      currentBalance: {
        increment: subtotal
      }
    }
  });
```

- [ ] **Step 2: Remove unused GRNI import if no longer referenced**

If `isPurchasesGrniEnabled` is unused elsewhere in `lib/goodsReceiptFollowOn.js`, remove:

```js
import { isPurchasesGrniEnabled } from '@/lib/purchases/grniPolicy';
```

Keep the import only if still used by other exports in that file.

- [ ] **Step 3: Run unit tests**

Run:

```bash
npx vitest run tests/unit/purchases/autoCreateBillFromReceipt.test.js
```

Expected: PASS (all four cases).

- [ ] **Step 4: Commit**

Skip unless the user explicitly asks to commit.

---

