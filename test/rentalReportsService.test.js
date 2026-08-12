import { describe, expect, it, vi } from 'vitest';
import { buildRentalHiringReport } from '../lib/rentalReportsService.js';

function buildPrisma() {
  return {
    invoice: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'i1',
          invoiceNumber: 'INV-001',
          status: 'Paid',
          total: 1000,
          taxAmount: 150,
          issueDate: new Date('2026-08-01'),
          isRentalInvoice: true,
          voidedAt: null,
          rentalTransaction: {
            id: 'rt1',
            kind: 'rental',
            startAt: new Date('2026-08-01'),
            endAt: new Date('2026-08-02'),
          },
        },
        {
          id: 'i2',
          invoiceNumber: 'INV-002',
          status: 'void',
          total: 500,
          taxAmount: 75,
          issueDate: new Date('2026-08-03'),
          isRentalInvoice: true,
          voidedAt: new Date('2026-08-04'),
          rentalTransaction: {
            id: 'rt2',
            kind: 'hiring',
            startAt: new Date('2026-08-03'),
            endAt: new Date('2026-08-05'),
          },
        },
      ]),
    },
    rentalCharge: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'c1',
          chargeType: 'DAMAGE',
          amount: 80,
          billingStatus: 'BILLED',
          createdAt: new Date('2026-08-02'),
        },
      ]),
    },
    expense: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'e1',
          amount: 120,
          notes: 'source=REPAIR rentalAssetId=asset-1',
          date: new Date('2026-08-02'),
        },
      ]),
    },
    rentalTransaction: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'rt1',
          kind: 'rental',
          startAt: new Date('2026-08-01'),
          endAt: new Date('2026-08-02'),
          items: [{ quantity: 2, billableUnits: 1 }],
        },
        {
          id: 'rt2',
          kind: 'hiring',
          startAt: new Date('2026-08-03'),
          endAt: new Date('2026-08-05'),
          items: [{ quantity: 3, billableUnits: 2 }],
        },
      ]),
    },
    // Hiring-v2 accrues supplier cost in HireAccrual; SupplierBill is linked when cleared.
    hireAccrual: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'ha1',
          amount: 300,
          status: 'ACCRUED',
          createdAt: new Date('2026-08-01'),
          agreement: { agreementNumber: 'HA-001' },
        },
      ]),
    },
  };
}

describe('buildRentalHiringReport', () => {
  const input = {
    tenantId: 't1',
    from: new Date('2026-08-01'),
    to: new Date('2026-08-31'),
  };

  it('sums revenue and tax, tracks voids, and excludes supplier accruals from revenue', async () => {
    const report = await buildRentalHiringReport({ prisma: buildPrisma(), ...input, type: 'all' });

    expect(report.revenue).toEqual({
      total: 1000,
      bySource: { RENTAL_SPACE: 1000, CUSTOMER_HIRE: 0 },
    });
    expect(report.tax.total).toBe(150);
    expect(report.reversals).toEqual({ count: 1, total: 500 });
    expect(report.damages).toEqual({ count: 1, total: 80 });
    expect(report.repairs).toEqual({ count: 1, total: 120 });
    expect(report.supplierHireSpend).toEqual({ count: 1, total: 300 });
    expect(report.revenue.total).not.toBe(1300);
    expect(report.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ invoiceId: 'i1', type: 'REVENUE', href: '/invoices' }),
        expect.objectContaining({ transactionId: 'rt2', type: 'REVERSAL' }),
        expect.objectContaining({ type: 'SUPPLIER_HIRE_SPEND' }),
      ])
    );
  });

  it('limits outbound revenue and utilization to the requested customer-hire source', async () => {
    const report = await buildRentalHiringReport({
      prisma: buildPrisma(),
      ...input,
      type: 'customer_hire',
    });

    expect(report.revenue.total).toBe(0);
    expect(report.reversals).toEqual({ count: 1, total: 500 });
    expect(report.utilization).toEqual({
      spaceBookings: 0,
      customerHireBookings: 1,
      qtyDays: 6,
    });
    expect(report.supplierHireSpend).toEqual({ count: 0, total: 0 });
  });

  it('records a voided invoice as a reversal only in its voided period', async () => {
    const prisma = buildPrisma();
    prisma.invoice.findMany.mockResolvedValue([
      {
        id: 'i3',
        invoiceNumber: 'INV-003',
        status: 'void',
        total: 750,
        taxAmount: 0,
        issueDate: new Date('2026-08-15'),
        voidedAt: new Date('2026-09-02'),
        rentalTransaction: { id: 'rt3', kind: 'rental' },
      },
    ]);

    const augustReport = await buildRentalHiringReport({
      prisma,
      tenantId: 't1',
      from: new Date('2026-08-01'),
      to: new Date('2026-08-31'),
    });
    const septemberReport = await buildRentalHiringReport({
      prisma,
      tenantId: 't1',
      from: new Date('2026-09-01'),
      to: new Date('2026-09-30'),
    });

    expect(augustReport.reversals).toEqual({ count: 0, total: 0 });
    expect(augustReport.revenue.total).toBe(0);
    expect(septemberReport.reversals).toEqual({ count: 1, total: 750 });
    expect(septemberReport.revenue.total).toBe(0);
  });

  it('includes tagged legacy damage invoices as damage without rental revenue', async () => {
    const prisma = buildPrisma();
    prisma.invoice.findMany.mockResolvedValue([
      {
        id: 'damage-invoice',
        invoiceNumber: 'INV-DAMAGE-001',
        status: 'Pending',
        total: 225,
        taxAmount: 0,
        issueDate: new Date('2026-08-12'),
        notes: 'source=DAMAGE rentalTransactionId=rt1',
        isRentalInvoice: true,
        voidedAt: null,
        rentalTransaction: null,
      },
    ]);

    const report = await buildRentalHiringReport({ prisma, ...input, type: 'space' });

    expect(report.damages).toEqual({ count: 2, total: 305 });
    expect(report.revenue.total).toBe(0);
    expect(report.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          invoiceId: 'damage-invoice',
          type: 'DAMAGE',
          href: '/invoices',
        }),
      ])
    );
  });

  it('includes customer-hire-tagged damages and repairs in customer-hire reports', async () => {
    const prisma = buildPrisma();
    prisma.invoice.findMany.mockResolvedValue([
      {
        id: 'customer-hire-damage',
        invoiceNumber: 'INV-DAMAGE-002',
        status: 'Pending',
        total: 225,
        taxAmount: 0,
        issueDate: new Date('2026-08-12'),
        notes: 'source=DAMAGE rentalSource=CUSTOMER_HIRE rentalTransactionId=rt2',
        isRentalInvoice: true,
        voidedAt: null,
        rentalTransaction: null,
      },
    ]);
    prisma.rentalCharge.findMany.mockResolvedValue([]);
    prisma.expense.findMany.mockResolvedValue([
      {
        id: 'customer-hire-repair',
        amount: 120,
        notes: 'source=REPAIR rentalSource=CUSTOMER_HIRE rentalAssetId=asset-1',
        date: new Date('2026-08-12'),
      },
    ]);

    const report = await buildRentalHiringReport({ prisma, ...input, type: 'customer_hire' });

    expect(report.damages).toEqual({ count: 1, total: 225 });
    expect(report.repairs).toEqual({ count: 1, total: 120 });
  });
});
