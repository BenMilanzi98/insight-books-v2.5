import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  transaction: {
    findMany: vi.fn(),
  },
}));

vi.mock('../lib/prisma.js', () => ({
  default: prismaMock,
}));

const { findInvoicePaymentJournalTransactionId } = await import(
  '../lib/financialReversalHelpers.js'
);

describe('findInvoicePaymentJournalTransactionId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches InvoicePayment rows with sourceId `{invoiceId}-payment-{reference}`', async () => {
    const invoiceId = 'inv-42';
    const paymentDate = new Date('2026-03-15T10:00:00.000Z');
    const txId = 'tx-payment-1';

    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: txId,
        createdAt: paymentDate,
        lines: [{ debitAmount: 1500, creditAmount: 0 }],
      },
    ]);

    const result = await findInvoicePaymentJournalTransactionId({
      tenantId: 'tenant-1',
      invoiceId,
      paymentAmount: 1500,
      paymentDate,
      paymentReference: 'RCPT-9001',
    });

    expect(result).toBe(txId);
    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceType: 'InvoicePayment',
          OR: expect.arrayContaining([
            { sourceId: invoiceId },
            { sourceId: { startsWith: `${invoiceId}-payment-` } },
            { sourceId: { contains: 'RCPT-9001' } },
          ]),
        }),
      })
    );
  });

  it('returns null when no posted journal matches amount on payment date', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([]);

    const result = await findInvoicePaymentJournalTransactionId({
      tenantId: 'tenant-1',
      invoiceId: 'inv-99',
      paymentAmount: 250,
      paymentDate: new Date('2026-01-01'),
    });

    expect(result).toBeNull();
  });

  it('picks the candidate closest to paymentCreatedAt when multiple match', async () => {
    const paymentDate = new Date('2026-02-10T12:00:00.000Z');
    const paymentCreatedAt = new Date('2026-02-10T12:05:00.000Z');

    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-early',
        createdAt: new Date('2026-02-10T11:00:00.000Z'),
        lines: [{ debitAmount: 100, creditAmount: 0 }],
      },
      {
        id: 'tx-close',
        createdAt: new Date('2026-02-10T12:04:00.000Z'),
        lines: [{ debitAmount: 100, creditAmount: 0 }],
      },
    ]);

    const result = await findInvoicePaymentJournalTransactionId({
      tenantId: 'tenant-1',
      invoiceId: 'inv-dup',
      paymentAmount: 100,
      paymentDate,
      paymentCreatedAt,
    });

    expect(result).toBe('tx-close');
  });
});
