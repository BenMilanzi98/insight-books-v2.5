/**
 * Legacy GL posting via postGlEntry is retired.
 * reverseGlEntry eventually calls postGlEntry — both must fail closed.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  default: {
    transaction: {
      findFirst: vi.fn(async ({ where }) => {
        if (where?.isReversal) return null;
        return {
          id: 'txn-payroll-original',
          tenantId: 'tenant-payroll-rev',
          description: 'Payroll',
          status: 'posted',
          isReversal: false,
          branchId: null,
          lines: [
            {
              lineNumber: 1,
              accountId: 'acc-salary',
              debitAmount: 500,
              creditAmount: 0,
              description: 'Salary',
            },
            {
              lineNumber: 2,
              accountId: 'acc-cash',
              debitAmount: 0,
              creditAmount: 500,
              description: 'Cash',
            },
          ],
        };
      }),
    },
  },
}));

import { postGlEntry } from '../lib/accountingEngine/postGlEntry.js';
import { reverseGlEntry } from '../lib/accountingEngine/reverseGlEntry.js';

describe('legacy payroll GL posting/reversal root', () => {
  it('fails closed when legacy postGlEntry path is invoked', async () => {
    await expect(
      postGlEntry({
        tenantId: 'tenant-payroll-rev',
        userId: 'user-1',
        entryDate: new Date('2026-05-12T09:30:00.000Z'),
        description: 'Payroll',
        sourceType: 'Payroll',
        sourceId: 'payroll-1',
        lines: [
          { accountId: 'acc-salary', debitAmount: 500, creditAmount: 0 },
          { accountId: 'acc-cash', debitAmount: 0, creditAmount: 500 },
        ],
      })
    ).rejects.toMatchObject({
      code: 'LEGACY_POSTING_REMOVED',
    });
  });

  it('fails closed when legacy reverseGlEntry reaches postGlEntry', async () => {
    await expect(
      reverseGlEntry({
        tenantId: 'tenant-payroll-rev',
        userId: 'user-1',
        originalTransactionId: 'txn-payroll-original',
        reason: 'Reverse payroll after correction approval',
        entryDate: new Date('2026-05-12T09:30:00.000Z'),
      })
    ).rejects.toMatchObject({
      code: 'LEGACY_POSTING_REMOVED',
    });
  });
});
