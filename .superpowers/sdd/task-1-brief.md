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

