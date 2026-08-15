### Task 7: Extract cloud `createSale` and idempotent outbox apply

**Files:**
- Create: `lib/sales/createSale.js` (move the existing POST body from `app/api/sales/route.js` **unchanged**, plus optional `saleNumber`)
- Modify: `app/api/sales/route.js` — POST becomes: auth → parse JSON → `createSale({ user, body, saleNumber })` → `NextResponse.json`
- Create: `lib/desktop/cloud/outboxApply.js`
- Create: `app/api/desktop/outbox/route.js`
- Create: `test/desktop/outboxApply.test.js`

**Interfaces:**
- Consumes: `createSale`, `openPosCashDay` / `closePosCashDay` from `lib/posCashDayService.js`, invoice/client/stock/payment existing functions as wired below
- Produces:
  - `createSale({ user, body, saleNumber }) → sale` — when `saleNumber` is a non-empty string, **do not** call `allocateNextSaleNumberReliable`; persist that number
  - `applyDesktopOutboxItem({ prisma, tenantId, user, deviceId, item: { id, kind, payload } }) → { serverId, result }`
  - Allowed `kind` values: `customer.upsert`, `customer.archive`, `stock.adjust`, `invoice.create`, `invoice.update`, `invoice.void`, `invoice.payment`, `pos.sale`, `pos.void`, `pos.refund`, `pos.cashDay.open`, `pos.cashDay.close`, `payment.create`
  - Unknown kind → throw `{ code: 'UNKNOWN_KIND' }`
  - If `DesktopOutboxReceipt` already has `{ tenantId, id }` → return stored `resultJson` without re-posting
  - After success, create receipt `{ id, tenantId, deviceId, kind, serverEntityId, resultJson }`

POST `/api/desktop/outbox` body: `{ deviceId, items: [{ id, kind, payload }] }`. Process **in array order**, stop on first failure, return `{ results: [...], stoppedAt?: id, error? }`. Do not apply later items after a failure.

- [ ] **Step 1: Idempotency tests with fake prisma + fake handlers**

```js
import { describe, expect, it, vi } from 'vitest';
import { applyDesktopOutboxItem } from '../../lib/desktop/cloud/outboxApply.js';

describe('applyDesktopOutboxItem', () => {
  it('returns the original result on duplicate id', async () => {
    const receipts = [
      { tenantId: 't1', id: 'm1', resultJson: { serverId: 'sale-1' }, serverEntityId: 'sale-1' },
    ];
    const createSale = vi.fn();
    const prisma = {
      desktopOutboxReceipt: {
        findUnique: async ({ where }) =>
          receipts.find((r) => r.tenantId === where.tenantId_id.tenantId && r.id === where.tenantId_id.id) || null,
        create: async ({ data }) => {
          receipts.push(data);
          return data;
        },
      },
    };
    const first = await applyDesktopOutboxItem({
      prisma,
      tenantId: 't1',
      user: { id: 'u1', tenantId: 't1' },
      deviceId: 'pc-a',
      item: { id: 'm1', kind: 'pos.sale', payload: {} },
      handlers: { 'pos.sale': createSale },
    });
    expect(first.serverId).toBe('sale-1');
    expect(createSale).not.toHaveBeenCalled();
  });

  it('calls handler once for a new id', async () => {
    const receipts = [];
    const createSale = vi.fn(async () => ({ id: 'sale-2' }));
    const prisma = {
      desktopOutboxReceipt: {
        findUnique: async () => null,
        create: async ({ data }) => {
          receipts.push(data);
          return data;
        },
      },
    };
    const r = await applyDesktopOutboxItem({
      prisma,
      tenantId: 't1',
      user: { id: 'u1', tenantId: 't1' },
      deviceId: 'pc-a',
      item: { id: 'm2', kind: 'pos.sale', payload: { total: 1 }, saleNumber: 'TILL1-SALE-1' },
      handlers: { 'pos.sale': createSale },
    });
    expect(createSale).toHaveBeenCalledTimes(1);
    expect(r.serverId).toBe('sale-2');
    expect(receipts).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implement `applyDesktopOutboxItem` with injectable `handlers` defaulting to real services**

Default handlers:
- `'pos.sale'` → `createSale({ user, body: payload, saleNumber: payload.saleNumber })` then `serverId = sale.id`
- `'pos.cashDay.open'` → `openPosCashDay({ tenantId, userId: user.id, ...payload })`
- `'pos.cashDay.close'` → existing close function from `lib/posCashDayService.js`
- `'pos.void'` → move the POST body of `app/api/sales/[id]/void/route.js` into `lib/sales/voidSale.js` as `voidSale({ user, saleId })`; route becomes a wrapper
- `'pos.refund'` → move the POST body of `app/api/sales/[id]/refund/route.js` into `lib/sales/refundSale.js` as `refundSale({ user, saleId, body })`
- `'invoice.create'` → move invoice POST create from `app/api/invoices/route.js` into `lib/invoices/createInvoice.js` as `createInvoice({ user, body, invoiceNumber })` (optional `invoiceNumber` skips `allocateNextInvNumberReliable`)
- `'invoice.update'` → move PUT/PATCH from `app/api/invoices/[id]/route.js` into `lib/invoices/updateInvoice.js`
- `'invoice.void'` → move `app/api/invoices/void/route.js` into `lib/invoices/voidInvoice.js`
- `'invoice.payment'` → move `app/api/invoices/partial-payment/route.js` into `lib/invoices/recordInvoicePayment.js`
- `'customer.upsert'` → prisma `client` upsert using the same fields as `app/api/clients/route.js` POST / `app/api/clients/[id]/route.js` PUT
- `'customer.archive'` → set `isActive: false` on `client` as `app/api/clients/[id]/route.js` does for archive
- `'stock.adjust'` → prisma product quantity update using the same validation as `app/api/stock/[id]/route.js` PATCH
- `'payment.create'` → move POST body of `app/api/payments/route.js` into `lib/payments/createPayment.js` as `createPayment({ user, body })`

`createSale` extract: cut the POST implementation from `app/api/sales/route.js` into `lib/sales/createSale.js`. The only behavior change allowed is: if `saleNumber` is passed, skip `allocateNextSaleNumberReliable` and use it.

- [ ] **Step 3: Run** `npx vitest run test/desktop/outboxApply.test.js`

Expected: PASS

Also run a quick sanity: `npx vitest run test/saleItemBaseQuantity.test.js` to ensure the extract did not break sale math.

- [ ] **Step 4: Commit** (skip unless asked)

---

