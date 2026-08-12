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

