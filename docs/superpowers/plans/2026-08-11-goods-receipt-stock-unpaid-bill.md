# Goods Receipt Instant Stock + Unpaid Bill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Posted inventory goods receipts always increase stock immediately and always create an **Unpaid** supplier bill (even when GRNI is on) so the amount appears on `/purchases/bills` and can be paid on `/purchases/payments`.

**Architecture:** Keep the existing receive orchestrator (`applyGoodsReceiptInventoryPosting`). Change only `autoCreateBillFromReceipt` so it never creates Draft / skips AP balance for GRNI. Enrich the receipts API response with the linked bill ids, and show a post-save success message with links on the receipts page.

**Tech Stack:** Next.js App Router, Prisma transaction client, Vitest, existing purchases libs (`lib/goodsReceiptFollowOn.js`, `lib/applyGoodsReceiptInventoryPosting.js`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-11-goods-receipt-stock-unpaid-bill-design.md` — follow locked decisions exactly.
- Always **Unpaid** on auto-bill from receipt; never **Draft** for this path, even if GRNI is enabled.
- Do **not** create `SupplierPayment` at receive time.
- Do **not** change future-dated receipt deferral / cron.
- Do **not** change service-receipt bill flows.
- Do **not** commit unless the user explicitly asks.
- Prefer TDD: failing test → implement → green for each task.
- Touch only root app paths (`lib/`, `app/`, `tests/`) — not `insight/` duplicates unless required.

---

## File map

| File | Responsibility |
|------|----------------|
| `lib/goodsReceiptFollowOn.js` | `autoCreateBillFromReceipt` always Unpaid + balance increment |
| `tests/unit/purchases/autoCreateBillFromReceipt.test.js` | Unit tests for Unpaid-always / idempotency / balance |
| `app/api/purchases/receipts/route.js` | Include `supplierBillId` / `billNumber` on POST response |
| `app/purchases/receipts/page.js` | Success notice with Bills / Payments links after receive |
| `lib/applyGoodsReceiptInventoryPosting.js` | No logic change expected; verify still calls auto-bill |

---

### Task 1: Failing unit tests for Unpaid-always auto bill

**Files:**
- Create: `tests/unit/purchases/autoCreateBillFromReceipt.test.js`
- Modify: (none yet)

**Interfaces:**
- Consumes: `autoCreateBillFromReceipt({ tx, goodsReceipt, supplier, purchaseOrder, tenantId, userId, journalEntryId })`
- Produces: Vitest coverage that fails while GRNI Draft behavior remains

- [ ] **Step 1: Write the failing test file**

Create `tests/unit/purchases/autoCreateBillFromReceipt.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/purchases/grniPolicy', () => ({
  isPurchasesGrniEnabled: vi.fn(),
}));

import { isPurchasesGrniEnabled } from '@/lib/purchases/grniPolicy';
import { autoCreateBillFromReceipt } from '@/lib/goodsReceiptFollowOn';

function makeTx({ existingBill = null } = {}) {
  const created = { id: 'bill-1', billNumber: 'GRB-GR-001', status: 'Unpaid' };
  return {
    supplierBill: {
      findFirst: vi
        .fn()
        // first call: idempotency check; later calls: bill-number uniqueness
        .mockResolvedValueOnce(existingBill)
        .mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }) => ({
        ...created,
        ...data,
        id: 'bill-1',
      })),
    },
    supplier: {
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

const baseArgs = {
  goodsReceipt: {
    id: 'gr-1',
    receiptNumber: 'GR-001',
    receiptDate: new Date('2026-08-01T00:00:00.000Z'),
    totalAmount: 250,
    purchaseOrderId: 'po-1',
    supplierReference: null,
    notes: null,
    items: [
      {
        lineNumber: 1,
        productId: 'prod-1',
        quantityReceived: 5,
        unitCost: 50,
        notes: '',
      },
    ],
  },
  supplier: {
    id: 'sup-1',
    paymentTerms: 30,
    currency: 'MWK',
  },
  purchaseOrder: { id: 'po-1', paymentTerms: 30 },
  tenantId: 'tenant-1',
  userId: 'user-1',
  journalEntryId: 'je-1',
};

describe('autoCreateBillFromReceipt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates Unpaid bill and increments supplier balance when GRNI is enabled', async () => {
    isPurchasesGrniEnabled.mockResolvedValue(true);
    const tx = makeTx();

    const bill = await autoCreateBillFromReceipt({ tx, ...baseArgs });

    expect(bill.status).toBe('Unpaid');
    expect(tx.supplierBill.create).toHaveBeenCalledTimes(1);
    const data = tx.supplierBill.create.mock.calls[0][0].data;
    expect(data.status).toBe('Unpaid');
    expect(data.journalEntryId).toBe('je-1');
    expect(data.finalizedAt).toBeInstanceOf(Date);
    expect(data.finalizedById).toBe('user-1');
    expect(data.amountPaid).toBe(0);
    expect(data.totalAmount).toBe(250);
    expect(tx.supplier.update).toHaveBeenCalledWith({
      where: { id: 'sup-1' },
      data: { currentBalance: { increment: 250 } },
    });
  });

  it('creates Unpaid bill when GRNI is disabled', async () => {
    isPurchasesGrniEnabled.mockResolvedValue(false);
    const tx = makeTx();

    await autoCreateBillFromReceipt({ tx, ...baseArgs });

    const data = tx.supplierBill.create.mock.calls[0][0].data;
    expect(data.status).toBe('Unpaid');
    expect(tx.supplier.update).toHaveBeenCalled();
  });

  it('returns existing bill without creating a second one', async () => {
    isPurchasesGrniEnabled.mockResolvedValue(true);
    const existing = { id: 'existing-bill', status: 'Unpaid', billNumber: 'GRB-GR-001' };
    const tx = makeTx({ existingBill: existing });

    const bill = await autoCreateBillFromReceipt({ tx, ...baseArgs });

    expect(bill).toEqual(existing);
    expect(tx.supplierBill.create).not.toHaveBeenCalled();
    expect(tx.supplier.update).not.toHaveBeenCalled();
  });

  it('returns null when receipt has no items', async () => {
    isPurchasesGrniEnabled.mockResolvedValue(true);
    const tx = makeTx();
    const bill = await autoCreateBillFromReceipt({
      tx,
      ...baseArgs,
      goodsReceipt: { ...baseArgs.goodsReceipt, items: [] },
    });
    expect(bill).toBeNull();
    expect(tx.supplierBill.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run tests/unit/purchases/autoCreateBillFromReceipt.test.js
```

Expected: FAIL — at least the GRNI-enabled case fails because create payload still uses `Draft` / skips `supplier.update`.

- [ ] **Step 3: Commit**

Skip unless the user explicitly asks to commit.

---

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

### Task 4: Receipts UI success notice with Bills / Payments links

**Files:**
- Modify: `app/purchases/receipts/page.js` (`postReceipt` consumer / `handleCreate` / page banner)

**Interfaces:**
- Consumes: `postReceipt` → `{ goodsReceipt: { supplierBillId, billNumber, billStatus, deferredStockPosting, stockPostingPending, ... } }`
- Produces: visible success message after inventory receive

- [ ] **Step 1: Capture POST result in `handleCreate`**

Replace:

```js
  const handleCreate = async (payload) => {
    await postReceipt(payload);
    setShowForm(false);
    await loadData();
  };
```

With state + handler:

Near other `useState` hooks on the page component (where `showForm` lives), add:

```js
  const [receiveNotice, setReceiveNotice] = useState(null);
```

Then:

```js
  const handleCreate = async (payload) => {
    const result = await postReceipt(payload);
    const gr = result?.goodsReceipt || null;
    setShowForm(false);

    if (payload?.receiptType === 'inventory' || (gr?.items && gr.items.length > 0)) {
      if (gr?.deferredStockPosting || gr?.stockPostingPending) {
        setReceiveNotice({
          tone: 'warning',
          title: 'Receipt posted — stock deferred',
          body: 'This receipt date is in the future. Stock and the unpaid bill will apply on the receipt date.',
          billNumber: gr?.billNumber || null,
        });
      } else {
        setReceiveNotice({
          tone: 'success',
          title: 'Goods received',
          body: gr?.billNumber
            ? `Stock updated. Unpaid bill ${gr.billNumber} is ready to pay.`
            : 'Stock updated. An unpaid supplier bill is ready on Bills / Payments.',
          billNumber: gr?.billNumber || null,
          supplierBillId: gr?.supplierBillId || null,
        });
      }
    } else {
      setReceiveNotice(null);
    }

    await loadData();
  };
```

- [ ] **Step 2: Render the notice above the list**

Inside the page return, above the receipts table / filters (and below the header actions), add:

```jsx
      {receiveNotice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            receiveNotice.tone === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{receiveNotice.title}</p>
              <p className="mt-1">{receiveNotice.body}</p>
              {receiveNotice.tone === 'success' && (
                <p className="mt-2 flex flex-wrap gap-3">
                  <a href="/purchases/bills" className="font-medium underline underline-offset-2">
                    Open Bills
                  </a>
                  <a href="/purchases/payments" className="font-medium underline underline-offset-2">
                    Open Payments
                  </a>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setReceiveNotice(null)}
              className="text-xs font-medium opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
```

Use `next/link` `Link` instead of `<a>` if the page already imports `Link`; otherwise plain anchors are fine for this notice.

- [ ] **Step 3: Manual UI verification**

1. Open `/purchases/receipts` → Receive Goods → post a same-day receipt for a known product.
2. Confirm product stock on `/stock` increased by received qty.
3. Confirm success notice appears with Bills / Payments links.
4. Open `/purchases/bills` — Unpaid bill `GRB-…` exists for the amount.
5. Open `/purchases/payments` — that unpaid bill is selectable; do **not** expect a payment to already exist.

- [ ] **Step 4: Commit**

Skip unless the user explicitly asks to commit.

---

### Task 5: Regression check — stock path still runs

**Files:**
- Verify only: `lib/applyGoodsReceiptInventoryPosting.js` (no change unless a bug is found)

**Interfaces:**
- Consumes: existing call to `autoCreateBillFromReceipt` after FIFO / inventory transactions
- Produces: confirmation stock + bill still coupled for non-deferred receipts

- [ ] **Step 1: Confirm call order is intact**

In `lib/applyGoodsReceiptInventoryPosting.js`, verify these still run in order inside one transaction:

1. `createFifoBatch(...)` per line (increments `Product.stockLevel`)
2. `inventoryTransaction.create` with `type: 'goods_receipt'`
3. `createPurchaseReceiptJournalEntry(...)`
4. set `inventoryAppliedAt`
5. `autoCreateBillFromReceipt(...)`

Do not reorder. Do not add payment creation.

- [ ] **Step 2: Re-run unit tests**

```bash
npx vitest run tests/unit/purchases/autoCreateBillFromReceipt.test.js
```

Expected: PASS.

- [ ] **Step 3: Done checklist vs spec success criteria**

- [ ] Stock increases on same-day receive
- [ ] Unpaid bill on Bills
- [ ] Bill selectable on Payments
- [ ] Works with GRNI on (unit test + manual if flag can be toggled)
- [ ] No payment auto-created
- [ ] Idempotent bill (unit test)

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| Stock ↑ on receive (existing path) | Task 5 verify + Task 4 manual |
| Always Unpaid auto-bill (incl. GRNI) | Tasks 1–2 |
| Balance increment on auto-bill | Tasks 1–2 |
| Idempotent one bill per receipt | Task 1 |
| No payment at receive | Tasks 2, 5 (explicit non-goal) |
| Future-date deferral unchanged | Task 4 warning notice only; no cron change |
| API bill ids for UI | Task 3 |
| UI toast/notice + links | Task 4 |
| Service receipts unchanged | Not modified |

## Placeholder scan

No TBD / “implement later” steps. Commit steps are explicit no-ops unless user asks.
