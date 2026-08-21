import { describe, expect, it, vi } from 'vitest';
import { createReconciliation } from '../lib/bankReconciliation/application/reconciliationService.js';
import { upsertConfiguration } from '../lib/bankReconciliation/application/configService.js';

const context = { businessId: 'biz-1', userId: 'user-1' };

const paymentAccount = {
  id: 'pa-1',
  tenantId: 'biz-1',
  isActive: true,
  accountType: 'Bank',
  coaAccountId: 'coa-bank',
  coaAccount: {
    tenantId: 'biz-1',
    postingAllowed: true,
    acceptsNewTransactions: true,
  },
};

describe('guided SoD default', () => {
  it('upserts missing requireSeparateApprover as false', async () => {
    const created = [];
    const db = {
      paymentAccount: { findFirst: vi.fn(async () => paymentAccount) },
      bankRecConfiguration: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }) => {
          created.push(data);
          return { id: 'cfg-1', ...data };
        }),
      },
    };
    await upsertConfiguration(db, context, { paymentAccountId: 'pa-1' });
    expect(created[0].requireSeparateApprover).toBe(false);
  });

  it('turns off requireSeparateApprover when opening a guided recon', async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const db = {
      paymentAccount: { findFirst: vi.fn(async () => paymentAccount) },
      bankRecConfiguration: {
        findFirst: vi.fn(async () => ({
          id: 'cfg-1',
          tenantId: 'biz-1',
          paymentAccountId: 'pa-1',
          requireSeparateApprover: true,
          currency: 'MWK',
        })),
        updateMany,
      },
      bankRecReconciliation: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        create: vi.fn(async ({ data }) => ({ id: 'rec-new', ...data })),
      },
      journalEntryLine: { findMany: vi.fn(async () => []) },
    };

    await createReconciliation(db, context, {
      paymentAccountId: 'pa-1',
      statementDate: '2026-08-31',
      statementClosingBalance: '100.00',
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'biz-1',
        requireSeparateApprover: true,
      }),
      data: expect.objectContaining({ requireSeparateApprover: false }),
    });
  });
});
