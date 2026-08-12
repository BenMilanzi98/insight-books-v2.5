### Task 2: Reverse orchestrator (availability + restock + invoice unwind)

**Files:**
- Create: `lib/rentalReverseService.js`
- Create: `test/rentalReverseService.test.js`
- Modify: `app/api/rentals/cancel/route.js`
- Modify: `app/rentals/RentalsClient.js` (button label / paid error UX)

**Interfaces:**
- Consumes: Prisma tx client; invoice payment totals; void semantics matching `/api/invoices/void`
- Produces: `reverseRentalBooking({ prisma, tenantId, userId, transactionId, reason })` →
  ```ts
  {
    ok: true,
    transactionId: string,
    alreadyReversed?: boolean,
    invoiceAction: 'deleted_draft' | 'voided' | 'none' | 'already_cancelled',
    invoiceId?: string | null,
  }
  // or throws / returns { ok:false, code:'NEED_CREDIT_REFUND'|'NOT_FOUND'|'CLOSED', error:string }
  ```

- [ ] **Step 1: Write failing unit tests**

Create `test/rentalReverseService.test.js` with a mock Prisma capturing calls:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reverseRentalBooking } from '../lib/rentalReverseService.js';

function buildPrisma({
  status = 'booked',
  kind = 'hiring',
  invoiceStatus = 'Pending',
  totalPaid = 0,
  invoiceId = 'inv-1',
  items = [{ id: 'ri-1', rentalAssetId: 'asset-1', quantity: 2, rentalAsset: { id: 'asset-1', kind: 'hiring', status: 'available' } }],
} = {}) {
  const rt = {
    id: 'rt-1',
    tenantId: 't1',
    status,
    kind,
    invoiceId,
    items,
    invoice: invoiceId
      ? {
          id: invoiceId,
          status: invoiceStatus,
          payments: totalPaid > 0 ? [{ status: 'Completed', amount: totalPaid }] : [],
        }
      : null,
  };

  const tx = {
    rentalTransaction: {
      findFirst: vi.fn().mockResolvedValue(rt),
      update: vi.fn().mockResolvedValue({ ...rt, status: 'cancelled' }),
    },
    rentalAssetAvailability: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    rentalAsset: {
      update: vi.fn().mockResolvedValue({}),
    },
    invoice: {
      delete: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(rt.invoice),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  };

  return {
    prisma: {
      $transaction: async (fn) => fn(tx),
      rentalTransaction: tx.rentalTransaction,
    },
    tx,
    rt,
  };
}

describe('reverseRentalBooking', () => {
  beforeEach(() => vi.clearAllMocks());

  it('idempotent when already cancelled', async () => {
    const { prisma } = buildPrisma({ status: 'cancelled' });
    const res = await reverseRentalBooking({
      prisma,
      tenantId: 't1',
      userId: 'u1',
      transactionId: 'rt-1',
      reason: 'test reverse',
    });
    expect(res.ok).toBe(true);
    expect(res.alreadyReversed).toBe(true);
  });

  it('blocks when invoice has payments', async () => {
    const { prisma } = buildPrisma({ totalPaid: 100, invoiceStatus: 'Paid' });
    const res = await reverseRentalBooking({
      prisma,
      tenantId: 't1',
      userId: 'u1',
      transactionId: 'rt-1',
      reason: 'customer cancelled',
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('NEED_CREDIT_REFUND');
  });

  it('deletes draft invoice, frees availability, restocks space asset', async () => {
    const { prisma, tx } = buildPrisma({
      kind: 'rental',
      invoiceStatus: 'draft',
      items: [
        {
          id: 'ri-1',
          rentalAssetId: 'asset-1',
          quantity: 1,
          rentalAsset: { id: 'asset-1', kind: 'rental', status: 'booked' },
        },
      ],
    });
    const res = await reverseRentalBooking({
      prisma,
      tenantId: 't1',
      userId: 'u1',
      transactionId: 'rt-1',
      reason: 'draft cancel',
    });
    expect(res.ok).toBe(true);
    expect(tx.rentalAssetAvailability.deleteMany).toHaveBeenCalledWith({
      where: { rentalTransactionId: 'rt-1' },
    });
    expect(tx.rentalAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-1' },
      data: { status: 'available' },
    });
    expect(tx.rentalTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rt-1' },
        data: expect.objectContaining({ status: 'cancelled', invoiceId: null }),
      })
    );
  });

  it('voids posted unpaid invoice then frees slots (calls voidHook)', async () => {
    const voidHook = vi.fn().mockResolvedValue({ ok: true });
    const { prisma, tx } = buildPrisma({ invoiceStatus: 'Pending', totalPaid: 0 });
    const res = await reverseRentalBooking({
      prisma,
      tenantId: 't1',
      userId: 'u1',
      transactionId: 'rt-1',
      reason: 'cancel booking',
      voidPostedInvoice: voidHook,
    });
    expect(res.ok).toBe(true);
    expect(voidHook).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: 'inv-1', tenantId: 't1', userId: 'u1' })
    );
    expect(tx.rentalAssetAvailability.deleteMany).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run test/rentalReverseService.test.js`  
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `lib/rentalReverseService.js`**

Core algorithm (exact behaviour):

1. `findFirst` RT by `id` + `tenantId` with `items.rentalAsset`, `invoice.payments` (Completed only).
2. If missing → `{ ok:false, code:'NOT_FOUND', error:'Transaction not found' }`.
3. If `status` in `cancelled` → `{ ok:true, alreadyReversed:true, invoiceAction:'already_cancelled' }` (do not delete availability again if already gone — safe no-op deleteMany is fine).
4. If `status === 'completed'` → `{ ok:false, code:'CLOSED', error:'Completed bookings cannot be reversed here' }` (use return/credit flows).
5. Sum completed payments on invoice; if `> 0` → `{ ok:false, code:'NEED_CREDIT_REFUND', error:'...' }` **before** any stock release.
6. Inside `$transaction`:
   - Draft / missing invoice / lowercase `draft`: unlink `invoiceId`, delete draft invoice if present, `invoiceAction='deleted_draft'`.
   - Else posted unpaid: call injected `voidPostedInvoice({ db: tx, invoiceId, tenantId, userId, reason })` which wraps the same GL reverse as `/api/invoices/void` (extract shared helper from void route if needed into `lib/invoiceVoidService.js`; if extraction is large, call void logic inline and keep route thin). Prefer extract: `voidInvoiceInTransaction({ tx, invoice, userId, reason })`.
   - `rentalAssetAvailability.deleteMany({ where: { rentalTransactionId } })`.
   - For each item where `rentalAsset.kind === 'rental'`: set asset `status: 'available'`.
   - Quantity pools: availability delete is the restock (capacity is computed from open availability rows — verify against `lib/rentalAvailability.js`). Do **not** invent a separate stock ledger unless one already exists.
   - Update RT: `{ status: 'cancelled', invoiceId: null }` (or keep invoiceId if voided for audit — prefer **keep** voided `invoiceId` link for Reports; only null when draft deleted). Spec: draft deleted; voided stay linked. Adjust tests accordingly:
     - Draft: delete invoice, set `invoiceId: null`.
     - Voided: keep `invoiceId`, status cancelled.
   - `auditLog.create` with `RENTAL_BOOKING_REVERSED` and `source` from `resolveOutboundInvoiceSource(rt.kind)`.

Default `voidPostedInvoice`: import shared void helper.

- [ ] **Step 4: Wire cancel route**

Replace body of `app/api/rentals/cancel/route.js` to call `reverseRentalBooking` and map codes to HTTP:

| code | status |
|------|--------|
| NOT_FOUND | 404 |
| NEED_CREDIT_REFUND | 409 |
| CLOSED | 400 |
| ok | 200 |

- [ ] **Step 5: UI — RentalsClient**

Rename cancel button to **Reverse** where appropriate; on 409 show message: “Invoice has payments — refund/credit on /invoices first, then reverse.”

- [ ] **Step 6: Run tests — expect PASS**

Run: `npx vitest run test/rentalReverseService.test.js`

Expected: PASS

- [ ] **Step 7: Commit only if user asked**

---

