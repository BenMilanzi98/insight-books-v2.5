import { beforeEach, describe, expect, it, vi } from 'vitest';

const postInvoiceRevenueRecognitionAccounting = vi.fn();

vi.mock('../lib/accountingV2/adapters/index.js', () => ({
  postInvoiceRevenueRecognitionAccounting: (...args) =>
    postInvoiceRevenueRecognitionAccounting(...args),
}));

vi.mock('../lib/accountingV2/adapters', () => ({
  postInvoiceRevenueRecognitionAccounting: (...args) =>
    postInvoiceRevenueRecognitionAccounting(...args),
}));

describe('ensureInvoicePaymentRevenueRecognition', () => {
  let db;

  beforeEach(() => {
    vi.clearAllMocks();
    postInvoiceRevenueRecognitionAccounting.mockResolvedValue({ ok: true });

    db = {
      invoice: {
        findFirst: vi.fn(),
      },
      journalEntry: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      coaV2AccountMapping: {
        findMany: vi.fn(),
      },
    };
  });

  it('skips recognition for legacy invoices that already credited sales revenue on issue', async () => {
    db.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      total: 1180,
      taxAmount: 180,
      payments: [{ id: 'pay-1', amount: 590, status: 'Completed', isReversal: false }],
    });
    db.journalEntry.findFirst.mockResolvedValueOnce({
      id: 'je-invoice',
      lines: [
        {
          accountId: 'acct-sales',
          creditAmount: 1000,
          account: { accountCode: '4100', accountSubtype: null },
        },
      ],
    });

    const { ensureInvoicePaymentRevenueRecognition } = await import(
      '../lib/ensureInvoicePaymentRevenueRecognition.js'
    );

    const result = await ensureInvoicePaymentRevenueRecognition({
      db,
      tenantId: 't1',
      userId: 'u1',
      invoiceId: 'inv-1',
      paymentId: 'pay-1',
      paymentAmount: 590,
    });

    expect(result).toEqual({ skipped: 'legacy_accrual' });
    expect(postInvoiceRevenueRecognitionAccounting).not.toHaveBeenCalled();
  });

  it('skips recognition when the invoice issue journal has not been posted yet', async () => {
    db.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      total: 1180,
      taxAmount: 180,
      payments: [{ id: 'pay-1', amount: 590, status: 'Completed', isReversal: false }],
    });
    db.journalEntry.findFirst.mockResolvedValueOnce(null);

    const { ensureInvoicePaymentRevenueRecognition } = await import(
      '../lib/ensureInvoicePaymentRevenueRecognition.js'
    );

    const result = await ensureInvoicePaymentRevenueRecognition({
      db,
      tenantId: 't1',
      userId: 'u1',
      invoiceId: 'inv-1',
      paymentId: 'pay-1',
      paymentAmount: 590,
    });

    expect(result).toEqual({ skipped: 'no_issue_journal' });
    expect(postInvoiceRevenueRecognitionAccounting).not.toHaveBeenCalled();
  });

  it('skips recognition when an Invoice-Revenue journal already exists for the payment', async () => {
    db.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      total: 1180,
      taxAmount: 180,
      payments: [{ id: 'pay-1', amount: 590, status: 'Completed', isReversal: false }],
    });
    db.journalEntry.findFirst
      .mockResolvedValueOnce({
        id: 'je-invoice',
        lines: [
          {
            accountId: 'acct-deferred',
            creditAmount: 1000,
            account: { accountCode: '2200', accountSubtype: null },
          },
        ],
      })
      .mockResolvedValueOnce({ id: 'je-rev' });
    db.coaV2AccountMapping.findMany.mockResolvedValue([]);

    const { ensureInvoicePaymentRevenueRecognition } = await import(
      '../lib/ensureInvoicePaymentRevenueRecognition.js'
    );

    const result = await ensureInvoicePaymentRevenueRecognition({
      db,
      tenantId: 't1',
      userId: 'u1',
      invoiceId: 'inv-1',
      paymentId: 'pay-1',
      paymentAmount: 590,
    });

    expect(result).toEqual({ skipped: 'already_posted' });
    expect(postInvoiceRevenueRecognitionAccounting).not.toHaveBeenCalled();
  });

  it('posts pro-rata recognized revenue for a partial payment', async () => {
    db.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      total: 1180,
      taxAmount: 180,
      payments: [{ id: 'pay-1', amount: 590, status: 'Completed', isReversal: false }],
    });
    db.journalEntry.findFirst
      .mockResolvedValueOnce({
        id: 'je-invoice',
        lines: [
          {
            accountId: 'acct-deferred',
            creditAmount: 1000,
            account: { accountCode: '2200', accountSubtype: null },
          },
        ],
      })
      .mockResolvedValueOnce(null);
    db.coaV2AccountMapping.findMany.mockResolvedValue([]);
    db.journalEntry.findMany.mockResolvedValue([]);

    const { ensureInvoicePaymentRevenueRecognition } = await import(
      '../lib/ensureInvoicePaymentRevenueRecognition.js'
    );

    await ensureInvoicePaymentRevenueRecognition({
      db,
      tenantId: 't1',
      userId: 'u1',
      invoiceId: 'inv-1',
      paymentId: 'pay-1',
      paymentAmount: 590,
    });

    expect(postInvoiceRevenueRecognitionAccounting).toHaveBeenCalledWith(
      expect.objectContaining({
        db,
        tenantId: 't1',
        userId: 'u1',
        invoiceId: 'inv-1',
        paymentId: 'pay-1',
        recognizedNet: 500,
      })
    );
  });

  it('uses the remaining net revenue on the final payment', async () => {
    db.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      total: 1180,
      taxAmount: 180,
      payments: [
        { id: 'pay-1', amount: 590, status: 'Completed', isReversal: false },
        { id: 'pay-2', amount: 590, status: 'Completed', isReversal: false },
      ],
    });
    db.journalEntry.findFirst
      .mockResolvedValueOnce({
        id: 'je-invoice',
        lines: [
          {
            accountId: 'acct-deferred',
            creditAmount: 1000,
            account: { accountCode: '2200', accountSubtype: null },
          },
        ],
      })
      .mockResolvedValueOnce(null);
    db.coaV2AccountMapping.findMany.mockResolvedValue([]);
    db.journalEntry.findMany.mockResolvedValue([
      {
        id: 'je-rev-1',
        sourceId: 'pay-1',
        metadata: { recognizedNet: '500.00' },
        totalCredit: '500.00',
      },
    ]);

    const { ensureInvoicePaymentRevenueRecognition } = await import(
      '../lib/ensureInvoicePaymentRevenueRecognition.js'
    );

    await ensureInvoicePaymentRevenueRecognition({
      db,
      tenantId: 't1',
      userId: 'u1',
      invoiceId: 'inv-1',
      paymentId: 'pay-2',
      paymentAmount: 590,
    });

    expect(postInvoiceRevenueRecognitionAccounting).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'pay-2',
        recognizedNet: 500,
      })
    );
  });
});
