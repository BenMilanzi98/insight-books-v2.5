import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  prismaMock,
  invoiceId,
  tenantId,
} = vi.hoisted(() => {
  const invoiceId_h = 'inv-partial-payment-1';
  const tenantId_h = 'tenant-reversal-1';

  const prismaMock_h = {
    invoice: {
      findFirst: vi.fn(async ({ where }) => {
        if (where?.id === invoiceId_h && where?.tenantId === tenantId_h) {
          return {
            id: invoiceId_h,
            tenantId: tenantId_h,
            status: 'partial',
            total: 1000,
            totalPaid: 250,
            isReversal: false,
          };
        }

        if (where?.reversedTransactionId === invoiceId_h && where?.isReversal === true) {
          return null;
        }

        return null;
      }),
    },
    expense: { findFirst: vi.fn() },
    payment: { findFirst: vi.fn() },
    sale: { findFirst: vi.fn() },
    supplierPayment: { findFirst: vi.fn() },
    transaction: { findFirst: vi.fn() },
    accountingPeriod: { findFirst: vi.fn() },
    transactionLine: { count: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };

  return {
    prismaMock: prismaMock_h,
    invoiceId: invoiceId_h,
    tenantId: tenantId_h,
  };
});

vi.mock('../lib/prisma.js', () => ({
  default: prismaMock,
}));

import { validateReversalEligibility } from '../lib/transactionReversalService.js';

describe('validateReversalEligibility for invoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invoice reversal when completed non-reversal payments remain', async () => {
    const result = await validateReversalEligibility({
      transactionId: invoiceId,
      transactionType: 'Invoice',
      tenantId,
    });

    expect(result).toEqual({
      isValid: false,
      error: 'Cannot reverse invoice with recorded payments; reverse/refund payments first.',
    });
  });
});
