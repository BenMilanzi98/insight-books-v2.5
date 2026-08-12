# Rentals & Hiring Three Hubs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a three-item Rentals & Hiring sidebar (Rentals, Hirings, Reports) with hard guarantees that outbound bookings create Customer Invoices on `/invoices`, reverse frees availability and restocks atomically, and revenue/tax/reversals/damages/repairs/supplier spend are reportable.

**Architecture:** Keep existing booking/invoice engines (`POST /api/rentals`, `postInvoiceAccounting`, invoice void). Add a shared reverse orchestrator, source-tag helpers, a Hirings tab shell, redirects for old URLs, and a Reports aggregator API+page. No full V2 contract rewrite.

**Tech Stack:** Next.js App Router, Prisma, Vitest, existing accounting V2 adapters (`postInvoiceAccounting`, invoice void / `reverseSourceJournals`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-11-rentals-hirings-three-hubs-design.md` — follow locked decisions exactly.
- Sidebar must expose only **Rentals**, **Hirings**, **Reports**.
- Rentals = spaces/rooms/venues only (`kind=rental`).
- Hirings = Customer hire + Supplier hire tabs.
- Supplier hire never creates Customer Invoices / rental revenue.
- Reverse of paid invoices must block until credit/refund (do not free stock while paid revenue unrecovered).
- Touch root app paths (`app/`, `lib/`, `test/`, `components/`, `next.config.mjs`, `prisma/` only if a field is required). Prefer **no schema migration** if tags can be derived from `RentalTransaction.kind` + `Invoice.isRentalInvoice`.
- Do **not** commit unless the user explicitly asks.
- Prefer TDD: failing test → implement → green for each task.
- Do not edit `insight/` duplicates unless a shared root import requires it.

## File map

| File | Responsibility |
|------|----------------|
| `lib/rentalSourceTags.js` | Map outbound kind → `RENTAL_SPACE` / `CUSTOMER_HIRE`; report event tags |
| `lib/rentalReverseService.js` | Atomic reverse: invoice unwind + free availability + restock + cancel status |
| `app/api/rentals/cancel/route.js` | Call reverse service (replace draft-only delete) |
| `lib/rentalReportsService.js` | Aggregate revenue/tax/reversals/damages/repairs/utilization/supplier spend |
| `app/api/rentals/reports/route.js` | GET reports for hub |
| `app/rentals/hirings/page.js` | Tab shell Customer \| Supplier |
| `app/rentals/reports/page.js` | Reports UI |
| `components/rentals/InboundHiringPanel.jsx` | Extracted from inbound page for Supplier tab |
| `components/Sidebar/Sidebar.js` | Three sub-items only; route permission map |
| `next.config.mjs` | Redirects `/rentals/hiring`, `/rentals/inbound-hiring` |
| `lib/rentalKinds.js` | Operator labels: Customer hire |
| `test/rentalSourceTags.test.js` | Tag mapping tests |
| `test/rentalReverseService.test.js` | Reverse orchestration tests |
| `test/rentalReportsService.test.js` | Aggregation tests |

---

### Task 1: Source tags + operator labels

**Files:**
- Create: `lib/rentalSourceTags.js`
- Create: `test/rentalSourceTags.test.js`
- Modify: `lib/rentalKinds.js`
- Modify: `test/rentalKinds.test.js`

**Interfaces:**
- Produces:
  - `OUTBOUND_INVOICE_SOURCE = { RENTAL_SPACE: 'RENTAL_SPACE', CUSTOMER_HIRE: 'CUSTOMER_HIRE' }`
  - `resolveOutboundInvoiceSource(kind: string|null): 'RENTAL_SPACE'|'CUSTOMER_HIRE'|null`
  - `RENTAL_TRACE_EVENT = { REVENUE, TAX, REVERSAL, DAMAGE, DAMAGE_LOSS, REPAIR, SUPPLIER_HIRE_SPEND, UTILIZATION }`
  - `outboundKindLabel(kind)` returns `'Customer hire'` for quantity pool (was `'Quantity rental'`)

- [ ] **Step 1: Write failing tests**

Create `test/rentalSourceTags.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  OUTBOUND_INVOICE_SOURCE,
  resolveOutboundInvoiceSource,
  RENTAL_TRACE_EVENT,
} from '../lib/rentalSourceTags.js';

describe('rentalSourceTags', () => {
  it('maps space rental kind to RENTAL_SPACE', () => {
    expect(resolveOutboundInvoiceSource('rental')).toBe(OUTBOUND_INVOICE_SOURCE.RENTAL_SPACE);
    expect(resolveOutboundInvoiceSource('space')).toBe(OUTBOUND_INVOICE_SOURCE.RENTAL_SPACE);
  });

  it('maps quantity pool / hiring kind to CUSTOMER_HIRE', () => {
    expect(resolveOutboundInvoiceSource('hiring')).toBe(OUTBOUND_INVOICE_SOURCE.CUSTOMER_HIRE);
    expect(resolveOutboundInvoiceSource('quantity_pool')).toBe(OUTBOUND_INVOICE_SOURCE.CUSTOMER_HIRE);
  });

  it('returns null for unknown / inbound kinds', () => {
    expect(resolveOutboundInvoiceSource('supplier_hire')).toBeNull();
    expect(resolveOutboundInvoiceSource(null)).toBeNull();
  });

  it('exports stable trace event constants', () => {
    expect(RENTAL_TRACE_EVENT.REVERSAL).toBe('REVERSAL');
    expect(RENTAL_TRACE_EVENT.DAMAGE).toBe('DAMAGE');
    expect(RENTAL_TRACE_EVENT.REPAIR).toBe('REPAIR');
    expect(RENTAL_TRACE_EVENT.SUPPLIER_HIRE_SPEND).toBe('SUPPLIER_HIRE_SPEND');
  });
});
```

Update expectation in `test/rentalKinds.test.js`:

```js
it('labels quantity pool for operators', () => {
  expect(outboundKindLabel('hiring')).toBe('Customer hire');
  expect(isQuantityPoolKind('hiring')).toBe(true);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run test/rentalSourceTags.test.js test/rentalKinds.test.js`

Expected: FAIL — missing module and/or label still `'Quantity rental'`.

- [ ] **Step 3: Implement**

Create `lib/rentalSourceTags.js`:

```js
import { normalizeOutboundRentalKind, OUTBOUND_RENTAL_KIND } from '@/lib/rentalKinds';

export const OUTBOUND_INVOICE_SOURCE = Object.freeze({
  RENTAL_SPACE: 'RENTAL_SPACE',
  CUSTOMER_HIRE: 'CUSTOMER_HIRE',
});

export const RENTAL_TRACE_EVENT = Object.freeze({
  REVENUE: 'REVENUE',
  TAX: 'TAX',
  REVERSAL: 'REVERSAL',
  DAMAGE: 'DAMAGE',
  DAMAGE_LOSS: 'DAMAGE_LOSS',
  REPAIR: 'REPAIR',
  SUPPLIER_HIRE_SPEND: 'SUPPLIER_HIRE_SPEND',
  UTILIZATION: 'UTILIZATION',
});

export function resolveOutboundInvoiceSource(kind) {
  const normalized = normalizeOutboundRentalKind(kind);
  if (normalized === OUTBOUND_RENTAL_KIND.RENTAL) return OUTBOUND_INVOICE_SOURCE.RENTAL_SPACE;
  if (normalized === OUTBOUND_RENTAL_KIND.QUANTITY_POOL) return OUTBOUND_INVOICE_SOURCE.CUSTOMER_HIRE;
  return null;
}
```

In `lib/rentalKinds.js`, change `outboundKindLabel`:

```js
export function outboundKindLabel(kind) {
  return isQuantityPoolKind(kind) ? 'Customer hire' : 'Rental';
}
```

In `app/api/rentals/route.js` invoice `create` data, set title using tags (keep behaviour, clearer copy):

```js
import { resolveOutboundInvoiceSource, OUTBOUND_INVOICE_SOURCE } from '@/lib/rentalSourceTags';
// ...
const source = resolveOutboundInvoiceSource(kind);
title:
  source === OUTBOUND_INVOICE_SOURCE.RENTAL_SPACE
    ? 'Room / space rental'
    : 'Customer hire (equipment pool)',
notes: [notes, source ? `source=${source}` : null].filter(Boolean).join('\n') || null,
```

Keep `isRentalInvoice: true`. Do not add Prisma fields unless tests prove notes are insufficient for Reports (Reports will join `rentalTransaction.kind`).

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run test/rentalSourceTags.test.js test/rentalKinds.test.js`

Expected: PASS

- [ ] **Step 5: Commit only if user asked**

```bash
git add lib/rentalSourceTags.js test/rentalSourceTags.test.js lib/rentalKinds.js test/rentalKinds.test.js app/api/rentals/route.js
# git commit only when user requests
```

---

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

### Task 3: Sidebar — three hubs + redirects + route permissions

**Files:**
- Modify: `components/Sidebar/Sidebar.js` (all three nav definitions: expandable subItems, `rental` group, `rentalSubItems`)
- Modify: `next.config.mjs` redirects
- Modify: path permission map in Sidebar (`"/rentals/hirings"`, `"/rentals/reports"`)

**Interfaces:**
- Produces: operators only see three links; old URLs redirect.

- [ ] **Step 1: Update sidebar subItems everywhere to**

```js
{ href: "/rentals", text: "Rentals", icon: "Rentals", permission: "rentals.view" },
{ href: "/rentals/hirings", text: "Hirings", icon: "Hiring", permission: "rentals.view" },
{ href: "/rentals/reports", text: "Reports", icon: "Reports", permission: "rentals.view" },
```

Remove Contracts V2, Quotations V2, Rental reconcile, Quantity rentals, Supplier hiring from sidebar arrays. Keep `ROUTE_PERMISSIONS` entries for deep-link pages if they still need access when visited directly.

Add:

```js
"/rentals/hirings": ["rentals.view"],
"/rentals/reports": ["rentals.view"],
```

- [ ] **Step 2: Redirects in `next.config.mjs`**

```js
{
  source: '/rentals/hiring',
  destination: '/rentals/hirings?tab=customer',
  permanent: false,
},
{
  source: '/rentals/inbound-hiring',
  destination: '/rentals/hirings?tab=supplier',
  permanent: false,
},
```

Note: Next.js redirects may strip query on some versions — if `?tab=` is unreliable, implement thin pages at old paths that `redirect()` from `next/navigation` with tab query instead.

Preferred fallback — replace `app/rentals/hiring/page.js`:

```js
import { redirect } from 'next/navigation';
export default function LegacyHiringRedirect() {
  redirect('/rentals/hirings?tab=customer');
}
```

And `app/rentals/inbound-hiring/page.js` → redirect to supplier tab (move UI into extracted component first in Task 4, then redirect this file).

- [ ] **Step 3: Manual check**

With `npm run dev`, open sidebar under Rental & Hiring — only three items. Hit `/rentals/hiring` — lands on Hirings customer tab (after Task 4 page exists; until then redirect may 404 — order Task 4 immediately after or create stub page in this task).

- [ ] **Step 4: Stub pages if Task 4 not yet done**

Create minimal `app/rentals/hirings/page.js` and `app/rentals/reports/page.js` placeholders (“Coming soon”) so redirects do not 404; Task 4/5 replace stubs.

- [ ] **Step 5: Commit only if user asked**

---

### Task 4: Hirings workspace (Customer + Supplier tabs)

**Files:**
- Create: `components/rentals/InboundHiringPanel.jsx` (move client UI from inbound page)
- Create/Replace: `app/rentals/hirings/page.js`
- Replace: `app/rentals/hiring/page.js` → redirect
- Replace: `app/rentals/inbound-hiring/page.js` → redirect after extract
- Reuse: `app/rentals/RentalsClient.js` with `mode="hiring"`

**Interfaces:**
- Consumes: `?tab=customer|supplier` (default `customer`)
- Produces: single page with two tabs; supplier panel uses existing `/api/hiring-v2/*`

- [ ] **Step 1: Extract inbound UI**

Move the client component body from `app/rentals/inbound-hiring/page.js` into `components/rentals/InboundHiringPanel.jsx` as `export default function InboundHiringPanel()`. Keep API calls identical.

- [ ] **Step 2: Build `app/rentals/hirings/page.js`**

Client page pattern:

```jsx
'use client';
import { useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PermissionGuard from '@/components/PermissionGuard';
import PosStylePageHeader from '@/components/shell/PosStylePageHeader';
import RentalsClient from '../RentalsClient';
import InboundHiringPanel from '@/components/rentals/InboundHiringPanel';

export default function HiringsPage() {
  const search = useSearchParams();
  const router = useRouter();
  const tab = search.get('tab') === 'supplier' ? 'supplier' : 'customer';

  const setTab = (next) => {
    router.replace(`/rentals/hirings?tab=${next}`);
  };

  return (
    <PermissionGuard permissions={['rentals.view']}>
      <div className="w-full p-4 sm:p-6">
        <PosStylePageHeader
          title="Hirings"
          subtitle="Customer hire (outbound) and supplier hire (inbound)"
        />
        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setTab('customer')} className={tab === 'customer' ? 'font-semibold' : ''}>
            Customer hire
          </button>
          <button type="button" onClick={() => setTab('supplier')} className={tab === 'supplier' ? 'font-semibold' : ''}>
            Supplier hire
          </button>
        </div>
        {tab === 'customer' ? <RentalsClient mode="hiring" embedded /> : <InboundHiringPanel />}
      </div>
    </PermissionGuard>
  );
}
```

If `RentalsClient` always renders its own full page chrome, add optional `embedded` prop to suppress duplicate title when true (minimal change: hide outer H1 when `embedded`).

Wrap with `Suspense` for `useSearchParams` if Next requires it.

- [ ] **Step 3: Redirects from old pages**

`hiring/page.js` and `inbound-hiring/page.js` become server redirects.

- [ ] **Step 4: Smoke check**

- Customer tab books → invoice with `isRentalInvoice` appears on `/invoices`.
- Supplier tab lists requests — no customer invoice created.

- [ ] **Step 5: Commit only if user asked**

---

### Task 5: Reports service + API + page

**Files:**
- Create: `lib/rentalReportsService.js`
- Create: `test/rentalReportsService.test.js`
- Create: `app/api/rentals/reports/route.js`
- Create/Replace: `app/rentals/reports/page.js`

**Interfaces:**
- Produces: `buildRentalHiringReport({ prisma, tenantId, from, to, type })` →

```js
{
  revenue: { total, bySource: { RENTAL_SPACE, CUSTOMER_HIRE } },
  tax: { total },
  reversals: { count, total },
  damages: { total, count },
  repairs: { total, count },
  utilization: { spaceBookings, customerHireBookings, qtyDays },
  supplierHireSpend: { total, count },
  rows: Array<{ date, type, label, amount, invoiceId?, transactionId?, href? }>
}
```

Filter `type`: `all` | `space` | `customer_hire` | `supplier_hire`.

- [ ] **Step 1: Failing tests with fake prisma**

```js
import { describe, it, expect, vi } from 'vitest';
import { buildRentalHiringReport } from '../lib/rentalReportsService.js';

describe('buildRentalHiringReport', () => {
  it('sums outbound invoice revenue/tax and voids as reversals; excludes supplier from revenue', async () => {
    const prisma = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'i1',
            status: 'Paid',
            total: 1000,
            taxAmount: 150,
            issueDate: new Date('2026-08-01'),
            isRentalInvoice: true,
            voidedAt: null,
            rentalTransaction: { id: 'rt1', kind: 'rental', startAt: new Date('2026-08-01'), endAt: new Date('2026-08-02') },
          },
          {
            id: 'i2',
            status: 'void',
            total: 500,
            taxAmount: 75,
            issueDate: new Date('2026-08-03'),
            isRentalInvoice: true,
            voidedAt: new Date('2026-08-04'),
            rentalTransaction: { id: 'rt2', kind: 'hiring', startAt: new Date('2026-08-03'), endAt: new Date('2026-08-05') },
          },
        ]),
      },
      rentalCharge: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'c1', chargeType: 'DAMAGE', amount: 80, billingStatus: 'BILLED', createdAt: new Date('2026-08-02') },
        ]),
      },
      expense: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'e1', amount: 120, notes: 'source=REPAIR rentalAssetId=asset-1', expenseDate: new Date('2026-08-02') },
        ]),
      },
      hireAgreement: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      // If supplier bills live on SupplierBill with hire link, mock that instead — inspect hiring-v2 bill action and match real model.
      supplierBill: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'sb1', total: 300, status: 'Unpaid', billDate: new Date('2026-08-01'), notes: 'source=SUPPLIER_HIRE' },
        ]),
      },
    };

    const report = await buildRentalHiringReport({
      prisma,
      tenantId: 't1',
      from: new Date('2026-08-01'),
      to: new Date('2026-08-31'),
      type: 'all',
    });

    expect(report.revenue.total).toBe(1000);
    expect(report.tax.total).toBe(150);
    expect(report.reversals.count).toBe(1);
    expect(report.damages.total).toBe(80);
    expect(report.repairs.total).toBe(120);
    expect(report.supplierHireSpend.total).toBe(300);
    expect(report.revenue.total).not.toBe(1300);
  });
});
```

Adjust mocks to **real** Prisma model names used by hiring-v2 bill posting (read `app/api/hiring-v2/agreements/[id]/[action]/route.js` before implementing and align the test).

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement aggregator**

Rules:
- Revenue: `isRentalInvoice` invoices in range where status not in `void`/`draft`/`cancelled`; classify via `rentalTransaction.kind`.
- Tax: sum `taxAmount` for those revenue invoices.
- Reversals: rental invoices with `status=void` or `voidedAt` set in range (use voidedAt for period).
- Damages: `RentalCharge` where `chargeType` matches `/damage|loss/i`.
- Repairs: expenses whose `notes` contain `source=REPAIR` or `RENTAL_REPAIR` (document this convention in hub UI for operators recording repairs); if Expense model field names differ, map accordingly.
- Utilization: count RTs by kind; qty-days ≈ sum over items of `quantity * billableUnits` or day span × qty.
- Supplier spend: bills/accruals tagged from hiring-v2 (inspect actual write path).

- [ ] **Step 4: API route**

`GET /api/rentals/reports?from=&to=&type=`
Auth via session + `rentals.view`; return JSON report.

Add tenant API access if needed: already covered by `/api/rentals` prefix.

- [ ] **Step 5: Reports page**

`/rentals/reports` with date filters, type select, metric cards, simple table of `rows`, links to `/invoices` when `invoiceId` present. Use `PosStylePageHeader` / glass panels.

- [ ] **Step 6: Tests PASS + smoke**

Run: `npx vitest run test/rentalReportsService.test.js`

- [ ] **Step 7: Commit only if user asked**

---

### Task 6: Damage / repair operator hooks (minimal tracing)

**Files:**
- Create: `app/api/rentals/charges/damage/route.js` (or extend complete/return)
- Modify: `app/rentals/RentalsClient.js` — optional “Record damage” on active booking
- Modify: expense create path **or** document notes convention — prefer small API that creates an Expense with `notes` including `source=REPAIR` + `rentalTransactionId=`

**Interfaces:**
- `POST /api/rentals/charges/damage` body `{ transactionId, amount, description }` → creates Customer Invoice line charge **or** standalone Pending invoice with `isRentalInvoice:true` + notes `source=DAMAGE`, linked via notes/`orderNumber=rt.id` if no FK; prefer creating `Invoice` + payment path on `/invoices`.
- `POST /api/rentals/charges/repair` body `{ transactionId?, rentalAssetId, amount, description }` → Expense with tagged notes for Reports.

Keep YAGNI: if V2 `RentalCharge` billing already exists for contracts, call into it when `contractId` present; for legacy RT-only bookings use invoice/expense tagging above.

- [ ] **Step 1: Unit test for tag helpers used by damage/repair create**

Extend `test/rentalSourceTags.test.js`:

```js
import { formatRentalTraceNote } from '../lib/rentalSourceTags.js';

it('formats repair/damage notes for report scraping', () => {
  expect(formatRentalTraceNote({ event: 'REPAIR', rentalTransactionId: 'rt-1' })).toContain('source=REPAIR');
  expect(formatRentalTraceNote({ event: 'DAMAGE', rentalTransactionId: 'rt-1' })).toContain('source=DAMAGE');
});
```

Implement:

```js
export function formatRentalTraceNote({ event, rentalTransactionId, rentalAssetId }) {
  return [
    `source=${event}`,
    rentalTransactionId ? `rentalTransactionId=${rentalTransactionId}` : null,
    rentalAssetId ? `rentalAssetId=${rentalAssetId}` : null,
  ]
    .filter(Boolean)
    .join(' ');
}
```

- [ ] **Step 2: Implement damage invoice create + repair expense create** following existing invoice/expense patterns in the codebase (copy money helpers, tax optional 0 for v1 damage unless tax types selected).

- [ ] **Step 3: Wire minimal UI actions on Rentals + Customer hire lists.**

- [ ] **Step 4: Confirm Reports picks up tagged rows.**

- [ ] **Step 5: Commit only if user asked**

---

### Task 7: Regression checklist (manual + automated)

**Files:**
- Optional: `test/rentalHubs.smoke.test.js` for pure redirects/tag invariants only (no DB).

- [ ] **Step 1: Automated**

```bash
npx vitest run test/rentalSourceTags.test.js test/rentalReverseService.test.js test/rentalReportsService.test.js test/rentalKinds.test.js test/rentalAvailability.test.js test/rentalBookingPolicy.test.js
```

Expected: all PASS.

- [ ] **Step 2: Manual checklist**

1. Sidebar shows only Rentals / Hirings / Reports.
2. Book space → invoice on `/invoices` → record payment.
3. Book customer hire → invoice on `/invoices` → payment.
4. Reverse draft → slots free + space available / pool capacity restored.
5. Reverse posted unpaid → invoice voided + slots free.
6. Reverse paid → 409 + guidance; after refund/credit, reverse succeeds.
7. Supplier hire bill → expense/AP only; Reports supplier spend increases; revenue unchanged.
8. Damage + repair → appear under Reports damages/repairs.
9. Deep links `/rentals/contracts-v2` still load for power users.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Three sidebar options | 3 |
| Rentals = spaces only | 3–4 (existing `/rentals` mode) |
| Hirings dual tabs | 4 |
| Hide Contracts/Quotations/Reconcile | 3 |
| Redirects old hiring URLs | 3–4 |
| Invoice on `/invoices` | 1 (tags) + existing book path |
| Reverse frees dates + restock | 2 |
| Paid reverse gated | 2 |
| Revenue/tax/reversals/damages/repairs/utilization/supplier | 5–6 |
| Supplier never customer revenue | 4–5 |
| POS-style headers | 4–5 |

## Placeholder scan

No TBD / “implement later” left; hiring-v2 supplier bill model must be confirmed by reading the action route in Task 5 Step 1 (explicit instruction, not a placeholder).

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-11-rentals-hirings-three-hubs.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?
