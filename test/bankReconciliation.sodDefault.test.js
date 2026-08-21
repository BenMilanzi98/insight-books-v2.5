import { describe, expect, it, vi } from 'vitest';
import {
  createReconciliation,
  getReconciliationWorkspace,
} from '../lib/bankReconciliation/application/reconciliationService.js';
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

  it('turns off requireSeparateApprover when resuming via workspace (create skipped)', async () => {
    const recon = {
      id: 'rec-open',
      tenantId: 'biz-1',
      paymentAccountId: 'pa-1',
      coaAccountId: 'coa-bank',
      status: 'IN_PROGRESS',
      statementDate: new Date('2026-08-31'),
      periodStart: null,
      periodEnd: new Date('2026-08-31'),
      statementClosingBalance: '100.00',
      depositsInTransit: '0.00',
      outstandingPayments: '0.00',
      currency: 'MWK',
    };
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
          staleOutstandingDays: 30,
          amountToleranceMinor: 0,
        })),
        updateMany,
      },
      bankRecReconciliation: {
        findFirst: vi.fn(async () => recon),
        update: vi.fn(async ({ data }) => ({ ...recon, ...data })),
      },
      bankRecStatementTransaction: {
        findMany: vi.fn(async () => []),
        groupBy: vi.fn(async () => []),
      },
      bankRecMatch: { findMany: vi.fn(async () => []) },
      bankRecOutstandingItem: {
        findMany: vi.fn(async () => []),
        deleteMany: vi.fn(async () => ({ count: 0 })),
        createMany: vi.fn(async () => ({ count: 0 })),
      },
      bankRecAdjustmentLink: { findMany: vi.fn(async () => []) },
      bankRecSnapshot: { findMany: vi.fn(async () => []) },
      journalEntryLine: { findMany: vi.fn(async () => []) },
      bankRecMatchLink: { findMany: vi.fn(async () => []) },
    };

    await getReconciliationWorkspace(db, context, recon.id);

    expect(updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'biz-1',
        requireSeparateApprover: true,
      }),
      data: expect.objectContaining({ requireSeparateApprover: false }),
    });
  });
});
