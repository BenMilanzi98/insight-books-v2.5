import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccountingContext } from '../lib/accountingV2/domain/accountingContext.js';
import { AccountingEventType, AccountingSourceModule } from '../lib/accountingV2/domain/enums.js';
import { LEGACY_SOURCE_SCOPE } from '../lib/accountingV2/engine/legacyGuard.js';
import { journalNumberPrefix } from '../lib/accountingV2/engine/journalNumbering.js';
import { validateSource } from '../lib/accountingV2/engine/sourceValidation.js';
import { getActiveTemplate } from '../lib/accountingV2/templates/index.js';

const submitViaCutover = vi.fn(async ({ buildEngineInput }) => ({
  input: await buildEngineInput(),
}));

vi.mock('../lib/accountingV2/adapters/baseAdapter.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    submitViaCutover: (...args) => submitViaCutover(...args),
  };
});

describe('invoice revenue recognition adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds Invoice-Revenue engine input keyed by payment id', async () => {
    const { postInvoiceRevenueRecognitionAccounting } = await import(
      '../lib/accountingV2/adapters/invoiceRevenueRecognitionAdapter.js'
    );

    const db = {
      payment: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'pay-1',
          tenantId: 'tenant-1',
          invoiceId: 'inv-1',
          paymentDate: new Date('2026-08-10T00:00:00.000Z'),
          branchId: 'branch-1',
          reference: 'RCPT-1',
          invoice: {
            id: 'inv-1',
            clientId: 'customer-1',
            invoiceNumber: 'INV-1',
          },
        }),
      },
      invoice: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'inv-1',
          tenantId: 'tenant-1',
          clientId: 'customer-1',
          invoiceNumber: 'INV-1',
        }),
      },
    };

    const result = await postInvoiceRevenueRecognitionAccounting({
      db,
      tenantId: 'tenant-1',
      userId: 'user-1',
      paymentId: 'pay-1',
      invoiceId: 'inv-1',
      recognizedNet: 500,
      paymentDate: '2026-08-10',
    });

    expect(submitViaCutover).toHaveBeenCalledTimes(1);
    expect(result.input).toMatchObject({
      sourceReference: {
        sourceType: 'Invoice-Revenue',
        sourceId: 'pay-1',
        eventType: AccountingEventType.INVOICE_REVENUE_RECOGNIZED,
      },
      transactionDate: '2026-08-10',
      requestedPostingDate: '2026-08-10',
      totalAmount: '500.00',
      taxAmount: '0.00',
      dimensions: {
        customerId: 'customer-1',
        branchId: 'branch-1',
      },
      metadata: {
        invoiceId: 'inv-1',
        paymentId: 'pay-1',
        recognizedNet: '500.00',
      },
    });
  });

  it('falls back to invoice branchId when payment has no branch', async () => {
    const { postInvoiceRevenueRecognitionAccounting } = await import(
      '../lib/accountingV2/adapters/invoiceRevenueRecognitionAdapter.js'
    );

    const db = {
      payment: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'pay-2',
          tenantId: 'tenant-1',
          invoiceId: 'inv-1',
          paymentDate: new Date('2026-08-10T00:00:00.000Z'),
          branchId: null,
          reference: 'RCPT-2',
          invoice: {
            id: 'inv-1',
            clientId: 'customer-1',
            invoiceNumber: 'INV-1',
            branchId: 'branch-from-invoice',
          },
        }),
      },
      invoice: { findFirst: vi.fn() },
    };

    const result = await postInvoiceRevenueRecognitionAccounting({
      db,
      tenantId: 'tenant-1',
      userId: 'user-1',
      paymentId: 'pay-2',
      invoiceId: 'inv-1',
      recognizedNet: 250,
      paymentDate: '2026-08-10',
    });

    expect(result.input.dimensions.branchId).toBe('branch-from-invoice');
    expect(submitViaCutover.mock.calls[0][0].context.branchId).toBe('branch-from-invoice');
  });

  it('skips cutover when recognized net is not positive', async () => {
    const { postInvoiceRevenueRecognitionAccounting } = await import(
      '../lib/accountingV2/adapters/invoiceRevenueRecognitionAdapter.js'
    );

    const result = await postInvoiceRevenueRecognitionAccounting({
      db: {},
      tenantId: 'tenant-1',
      userId: 'user-1',
      paymentId: 'pay-1',
      invoiceId: 'inv-1',
      recognizedNet: 0,
    });

    expect(submitViaCutover).not.toHaveBeenCalled();
    expect(result).toEqual({
      skipped: 'recognized_net_non_positive',
      paymentId: 'pay-1',
      invoiceId: 'inv-1',
      recognizedNet: 0,
    });
  });

  it('rejects when provided invoiceId does not match the payment invoice link', async () => {
    const { postInvoiceRevenueRecognitionAccounting } = await import(
      '../lib/accountingV2/adapters/invoiceRevenueRecognitionAdapter.js'
    );

    const db = {
      payment: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'pay-1',
          tenantId: 'tenant-1',
          invoiceId: 'inv-actual',
          paymentDate: new Date('2026-08-10T00:00:00.000Z'),
          branchId: 'branch-1',
          reference: 'RCPT-1',
          invoice: {
            id: 'inv-actual',
            clientId: 'customer-1',
            invoiceNumber: 'INV-ACTUAL',
          },
        }),
      },
      invoice: {
        findFirst: vi.fn(),
      },
    };

    await expect(
      postInvoiceRevenueRecognitionAccounting({
        db,
        tenantId: 'tenant-1',
        userId: 'user-1',
        paymentId: 'pay-1',
        invoiceId: 'inv-requested',
        recognizedNet: 500,
        paymentDate: '2026-08-10',
      })
    ).rejects.toThrow(/linked to invoice inv-actual, not inv-requested/i);

    expect(submitViaCutover).not.toHaveBeenCalled();
  });
});

describe('invoice revenue recognition template + wiring', () => {
  it('registers an ACTIVE template for INVOICE_REVENUE_RECOGNIZED', async () => {
    const template = getActiveTemplate(AccountingEventType.INVOICE_REVENUE_RECOGNIZED);
    expect(template).toBeTruthy();
    expect(template.templateId).toBe('INVOICE_REVENUE_RECOGNITION');
    expect(template.supportedSourceTypes).toContain('Invoice-Revenue');
  });

  it('builds Dr deferred revenue / Cr sales revenue lines', async () => {
    const template = getActiveTemplate(AccountingEventType.INVOICE_REVENUE_RECOGNIZED);
    const draft = await template.buildDraft({
      command: {
        sourceReference: {
          sourceModule: AccountingSourceModule.SALES,
          sourceType: 'Invoice-Revenue',
          sourceId: 'pay-1',
          eventType: AccountingEventType.INVOICE_REVENUE_RECOGNIZED,
        },
        transactionDate: '2026-08-10',
        requestedPostingDate: '2026-08-10',
        currency: 'MWK',
        totalAmount: '500.00',
        taxAmount: '0.00',
        description: 'Invoice revenue recognition',
        dimensions: { customerId: 'customer-1' },
        metadata: { recognizedNet: '500.00' },
      },
      source: {
        id: 'pay-1',
        invoiceNumber: 'INV-1',
        clientId: 'customer-1',
      },
      resolvePurpose: async (purpose) => ({ id: `acct-${purpose}` }),
    });

    expect(draft.lines).toHaveLength(2);
    expect(draft.lines[0]).toMatchObject({
      accountId: 'acct-DEFERRED_REVENUE',
    });
    expect(draft.lines[0].debit?.decimal).toBe('500.00');
    expect(draft.lines[1]).toMatchObject({
      accountId: 'acct-SALES_REVENUE',
    });
    expect(draft.lines[1].credit?.decimal).toBe('500.00');
  });

  it('accepts Invoice-Revenue source validation on a completed payment', async () => {
    const db = {
      payment: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'pay-1',
          tenantId: 'tenant-1',
          status: 'Completed',
          isReversal: false,
          invoiceId: 'inv-1',
          invoice: {
            id: 'inv-1',
            tenantId: 'tenant-1',
            clientId: 'customer-1',
            invoiceNumber: 'INV-1',
          },
        }),
      },
    };

    const command = {
      sourceReference: {
        sourceModule: AccountingSourceModule.SALES,
        sourceType: 'Invoice-Revenue',
        sourceId: 'pay-1',
        eventType: AccountingEventType.INVOICE_REVENUE_RECOGNIZED,
      },
      totalAmount: '500.00',
      metadata: {
        recognizedNet: '500.00',
      },
    };

    const source = await validateSource(
      db,
      createAccountingContext({ businessId: 'tenant-1', userId: 'user-1', sourceChannel: 'test' }),
      command
    );

    expect(source).toMatchObject({
      id: 'pay-1',
      invoiceId: 'inv-1',
    });
  });

  it('rejects source validation when the payment is not linked to an invoice', async () => {
    const db = {
      payment: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'pay-1',
          tenantId: 'tenant-1',
          status: 'Completed',
          isReversal: false,
          invoiceId: null,
          invoice: null,
        }),
      },
    };

    const command = {
      sourceReference: {
        sourceModule: AccountingSourceModule.SALES,
        sourceType: 'Invoice-Revenue',
        sourceId: 'pay-1',
        eventType: AccountingEventType.INVOICE_REVENUE_RECOGNIZED,
      },
      totalAmount: '500.00',
      metadata: {
        invoiceId: 'inv-1',
        recognizedNet: '500.00',
      },
    };

    await expect(
      validateSource(
        db,
        createAccountingContext({ businessId: 'tenant-1', userId: 'user-1', sourceChannel: 'test' }),
        command
      )
    ).rejects.toThrow(/must be linked to an invoice/i);
  });

  it('wires legacy scope and journal numbering', () => {
    expect(LEGACY_SOURCE_SCOPE['Invoice-Revenue']).toMatchObject({
      eventType: AccountingEventType.INVOICE_REVENUE_RECOGNIZED,
    });
    expect([
      AccountingSourceModule.SALES,
      AccountingSourceModule.RECEIVABLES,
    ]).toContain(LEGACY_SOURCE_SCOPE['Invoice-Revenue'].moduleKey);
    expect(journalNumberPrefix(AccountingEventType.INVOICE_REVENUE_RECOGNIZED)).toBe('REV');
  });
});
