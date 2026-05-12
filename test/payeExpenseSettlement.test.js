import { describe, it, expect, vi } from 'vitest';
import {
  applyPayeSettlementToExpenses,
  isPayeTaxType,
  sumPaidPayeExpenses,
} from '../lib/payeExpenseSettlement.js';

describe('PAYE expense settlement sync', () => {
  it('identifies PAYE tax types', () => {
    expect(isPayeTaxType({ taxId: 'PAYE', taxName: 'Income tax' })).toBe(true);
    expect(isPayeTaxType({ taxId: 'VAT', taxName: 'PAYE Withholding' })).toBe(true);
    expect(isPayeTaxType({ taxId: 'VAT', taxName: 'VAT 16.5%' })).toBe(false);
  });

  it('applies a tax-account PAYE settlement to outstanding PAYE expenses oldest first', async () => {
    const updates = [];
    const periodExpenses = [
      {
        id: 'exp-1',
        amount: 100,
        taxAmount: 0,
        paidAmount: 0,
        paymentStatus: 'Pending',
        date: new Date('2026-04-01'),
        paymentReference: null,
      },
      {
        id: 'exp-2',
        amount: 150,
        taxAmount: 0,
        paidAmount: 50,
        paymentStatus: 'Partially',
        date: new Date('2026-04-02'),
        paymentReference: null,
      },
    ];

    const tx = {
      expense: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce(periodExpenses)
          .mockResolvedValueOnce([]),
        update: vi.fn(async ({ where, data }) => {
          updates.push({ id: where.id, ...data });
          return { id: where.id, ...data };
        }),
      },
    };

    const result = await applyPayeSettlementToExpenses(tx, {
      tenantId: 'tenant-1',
      taxTypeId: 'paye-tax',
      amount: 180,
      settlementDate: new Date('2026-04-30'),
      paymentMethod: 'cash-account',
      reference: 'Tax Settlement - abc',
      taxPeriod: '2026-04-01 to 2026-04-30',
    });

    expect(result).toMatchObject({
      appliedAmount: 180,
      updatedCount: 2,
      unappliedAmount: 0,
    });
    expect(updates).toEqual([
      {
        id: 'exp-1',
        paidAmount: 100,
        paymentStatus: 'Fully paid',
        paymentMethod: 'cash-account',
        paymentReference: 'Tax Settlement - abc',
      },
      {
        id: 'exp-2',
        paidAmount: 130,
        paymentStatus: 'Partially',
        paymentMethod: 'cash-account',
        paymentReference: 'Tax Settlement - abc',
      },
    ]);
  });

  it('sums paid PAYE expense amounts capped at each expense total', async () => {
    const tx = {
      expense: {
        findMany: vi.fn(async () => [
          { id: 'a', description: 'PAYE A', date: new Date('2026-05-01'), paidAmount: 75, amount: 100, taxAmount: 0 },
          { id: 'b', description: 'PAYE B', date: new Date('2026-05-02'), paidAmount: 120, amount: 90, taxAmount: 0 },
        ]),
      },
    };

    const result = await sumPaidPayeExpenses(tx, {
      tenantId: 'tenant-1',
      taxTypeId: 'paye-tax',
      dateFilter: { gte: new Date('2026-05-01'), lte: new Date('2026-05-31') },
    });

    expect(result.total).toBe(165);
    expect(result.rows.map((row) => row.amount)).toEqual([75, 90]);
  });
});
