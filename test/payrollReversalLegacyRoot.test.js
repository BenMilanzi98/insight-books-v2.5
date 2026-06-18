import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  prismaMock,
  updateBalanceMock,
  recalculateBalanceMock,
  periodChecks,
  resetMocks,
} = vi.hoisted(() => {
  const tenantId = 'tenant-payroll-rev';
  const originalDate = new Date('2025-01-31T10:00:00.000Z');
  const originalTransaction = {
    id: 'txn-payroll-original',
    tenantId,
    date: originalDate,
    sourceType: 'Payroll',
    sourceId: 'payroll-1',
    status: 'posted',
    description: 'Payroll for Employee',
    reference: 'PAY-001',
    branchId: null,
    amount: 500,
    isReversal: false,
  };
  const originalLines = [
    {
      lineNumber: 1,
      accountId: 'acc-salary-expense',
      debitAmount: 500,
      creditAmount: 0,
      description: 'Payroll expense',
      account: { accountName: 'Salaries Expense' },
    },
    {
      lineNumber: 2,
      accountId: 'acc-assets-root',
      debitAmount: 0,
      creditAmount: 500,
      description: 'Net pay cash',
      account: { accountName: 'Assets', accountCode: '1000' },
    },
  ];
  const periodChecks_h = [];
  const updateBalanceMock_h = vi.fn(async () => 0);
  const recalculateBalanceMock_h = vi.fn(async () => 0);

  function makeTxApi() {
    return {
      transaction: {
        findFirst: vi.fn(async ({ where, include }) => {
          if (where?.id === originalTransaction.id && where?.tenantId === tenantId) {
            if (include?.lines) {
              return { ...originalTransaction, lines: originalLines };
            }
            return originalTransaction;
          }
          if (where?.reversedTransactionId === originalTransaction.id) return null;
          return null;
        }),
        create: vi.fn(async ({ data, include }) => {
          const createdLines = (data.lines?.create || []).map((line, idx) => ({
            id: `rev-line-${idx + 1}`,
            ...line,
          }));
          return { id: 'txn-payroll-reversal', ...data, lines: createdLines };
        }),
        update: vi.fn(async ({ data }) => data),
        count: vi.fn(async () => 0),
      },
      transactionLine: {
        create: vi.fn(async ({ data }) => ({ id: `line-${data.lineNumber}`, ...data })),
      },
      payroll: {
        findFirst: vi.fn(async () => ({
          id: 'payroll-1',
          tenantId,
          employeeId: 'emp-1',
          status: 'Posted',
          periodStart: new Date('2025-01-01T00:00:00.000Z'),
          periodEnd: new Date('2025-01-31T00:00:00.000Z'),
          gratuityAccruedAmount: 0,
          employee: { name: 'Employee One', gratuityAccount: null },
        })),
        update: vi.fn(async ({ data }) => data),
      },
      advanceDeduction: {
        findMany: vi.fn(async () => []),
      },
      expense: {
        findMany: vi.fn(async () => []),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
      payment: {
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
      auditLog: {
        create: vi.fn(async ({ data }) => data),
      },
      account: {
        findMany: vi.fn(async ({ where }) => {
          const ids = where?.id?.in || [];
          return ids.map((id) => ({
            id,
            tenantId,
            accountCode: id === 'acc-assets-root' ? '1000' : '5300',
            accountName: id === 'acc-assets-root' ? 'Assets' : 'Salaries',
            accountType: id === 'acc-assets-root' ? 'Asset' : 'Expense',
            isActive: true,
            acceptsNewTransactions: true,
            mergedIntoAccountId: null,
            _count: { childAccounts: id === 'acc-assets-root' ? 1 : 0 },
          }));
        }),
      },
    };
  }

  const prismaMock_h = {
    transaction: {
      findFirst: vi.fn(async ({ where }) => {
        if (where?.reversedTransactionId === originalTransaction.id) return null;
        if (where?.id === originalTransaction.id && where?.tenantId === tenantId) {
          return originalTransaction;
        }
        return null;
      }),
      findMany: vi.fn(async () => []),
    },
    transactionLine: {
      findMany: vi.fn(async () => originalLines),
    },
    accountingPeriod: {
      findFirst: vi.fn(async ({ where }) => {
        periodChecks_h.push(where?.startDate?.lte);
        return null;
      }),
    },
    $transaction: vi.fn(async (fn) => fn(makeTxApi())),
  };

  function resetMocks_h() {
    periodChecks_h.length = 0;
    updateBalanceMock_h.mockClear();
    recalculateBalanceMock_h.mockClear();
    prismaMock_h.transaction.findFirst.mockClear();
    prismaMock_h.transaction.findMany.mockClear();
    prismaMock_h.transactionLine.findMany.mockClear();
    prismaMock_h.accountingPeriod.findFirst.mockClear();
    prismaMock_h.$transaction.mockClear();
  }

  return {
    prismaMock: prismaMock_h,
    updateBalanceMock: updateBalanceMock_h,
    recalculateBalanceMock: recalculateBalanceMock_h,
    periodChecks: periodChecks_h,
    resetMocks: resetMocks_h,
  };
});

vi.mock('../lib/prisma.js', () => ({
  default: prismaMock,
}));

vi.mock('../lib/accountBalanceService.js', () => ({
  updateAccountBalanceOnTransaction: updateBalanceMock,
  recalculateAccountBalance: recalculateBalanceMock,
}));

vi.mock('../lib/journalService.js', () => ({
  generateReferenceNumber: vi.fn(async () => 'REF-MOCK'),
}));

import { createTransactionReversal } from '../lib/transactionReversalService.js';

describe('createTransactionReversal payroll legacy account handling', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('posts payroll reversal on reversal date and allows cancelling legacy 1000 root lines', async () => {
    const reversalDate = new Date('2026-05-12T09:30:00.000Z');

    await createTransactionReversal({
      transactionId: 'txn-payroll-original',
      reversalReason: 'Reverse payroll after correction approval',
      userId: 'user-1',
      tenantId: 'tenant-payroll-rev',
      reversalDate,
    });

    expect(periodChecks).toEqual([reversalDate]);
    expect(updateBalanceMock).toHaveBeenCalledWith(
      'acc-assets-root',
      500,
      0,
      expect.anything(),
      { allowBlockedAccountForReversal: true },
    );
    expect(recalculateBalanceMock).toHaveBeenCalledWith(
      'acc-assets-root',
      'tenant-payroll-rev',
      expect.anything(),
    );
  });
});
