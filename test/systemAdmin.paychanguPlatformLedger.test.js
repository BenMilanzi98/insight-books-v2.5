import { describe, it, expect, vi } from 'vitest';
import {
  buildPaychanguPaidInvoiceSpec,
  ensurePaychanguPlatformLedger,
} from '@/lib/admin/paychanguPlatformLedger';
import { invoiceIdempotencyKey, paymentIdempotencyKey } from '@/lib/admin/platformBilling';

describe('PayChangu platform ledger', () => {
  it('buildPaychanguPaidInvoiceSpec creates PAID invoice body with stable idempotency', () => {
    const periodStart = '2026-07-01T00:00:00.000Z';
    const periodEnd = '2026-08-01T00:00:00.000Z';
    const a = buildPaychanguPaidInvoiceSpec({
      tenantId: 't1',
      subscriptionId: 'sub1',
      periodStart,
      periodEnd,
      amount: 50000,
      currency: 'MWK',
      planCode: '1month',
    });
    expect(a.ok).toBe(true);
    expect(a.invoice.status).toBe('PAID');
    expect(a.invoice.total).toBe(50000);
    expect(a.invoice.amountPaid).toBe(50000);
    expect(a.invoice.outstanding).toBe(0);
    expect(a.invoice.idempotencyKey).toBe(
      invoiceIdempotencyKey({
        tenantId: 't1',
        subscriptionId: 'sub1',
        periodStart,
        periodEnd,
      })
    );

    const b = buildPaychanguPaidInvoiceSpec({
      tenantId: 't1',
      subscriptionId: 'sub1',
      periodStart,
      periodEnd,
      amount: 50000,
      currency: 'MWK',
      planCode: '1month',
    });
    expect(b.invoice.idempotencyKey).toBe(a.invoice.idempotencyKey);
  });

  it('buildPaychanguPaidInvoiceSpec rejects missing tenant/subscription', () => {
    expect(
      buildPaychanguPaidInvoiceSpec({
        tenantId: '',
        subscriptionId: 's',
        periodStart: '2026-01-01',
        periodEnd: '2026-02-01',
        amount: 10,
      }).ok
    ).toBe(false);
  });

  it('ensurePaychanguPlatformLedger creates invoice then payment linked to it (idempotent)', async () => {
    const store = { invoices: [], payments: [] };
    const prisma = {
      platformInvoice: {
        findUnique: vi.fn(async ({ where }) =>
          store.invoices.find((i) => i.idempotencyKey === where.idempotencyKey) || null
        ),
        create: vi.fn(async ({ data }) => {
          const row = { id: 'inv-1', ...data };
          store.invoices.push(row);
          return row;
        }),
        update: vi.fn(async ({ where, data }) => {
          const row = store.invoices.find((i) => i.id === where.id);
          Object.assign(row, data);
          return row;
        }),
      },
      platformPayment: {
        findUnique: vi.fn(async ({ where }) => {
          if (where.idempotencyKey) {
            return store.payments.find((p) => p.idempotencyKey === where.idempotencyKey) || null;
          }
          return null;
        }),
        create: vi.fn(async ({ data }) => {
          const row = { id: 'pay-1', ...data };
          store.payments.push(row);
          return row;
        }),
        update: vi.fn(async ({ where, data }) => {
          const row = store.payments.find((p) => p.id === where.id);
          Object.assign(row, data);
          return row;
        }),
      },
    };

    const input = {
      tenantId: 't1',
      subscriptionId: 'sub1',
      periodStart: new Date('2026-07-01T00:00:00.000Z'),
      periodEnd: new Date('2026-08-01T00:00:00.000Z'),
      amount: 50000,
      currency: 'MWK',
      planCode: '1month',
      gatewayReference: 'TX-ABC',
      method: 'PayChangu',
    };

    const first = await ensurePaychanguPlatformLedger(prisma, input);
    expect(first.ok).toBe(true);
    expect(first.createdInvoice).toBe(true);
    expect(first.createdPayment).toBe(true);
    expect(first.invoice.id).toBe('inv-1');
    expect(first.payment.invoiceId).toBe('inv-1');
    expect(first.payment.status).toBe('COMPLETED');
    expect(first.payment.idempotencyKey).toBe(
      paymentIdempotencyKey({ gateway: 'PayChangu', gatewayReference: 'TX-ABC' })
    );

    const second = await ensurePaychanguPlatformLedger(prisma, input);
    expect(second.ok).toBe(true);
    expect(second.createdInvoice).toBe(false);
    expect(second.createdPayment).toBe(false);
    expect(prisma.platformInvoice.create).toHaveBeenCalledTimes(1);
    expect(prisma.platformPayment.create).toHaveBeenCalledTimes(1);
  });

  it('ensurePaychanguPlatformLedger links an existing orphan payment to the invoice', async () => {
    const invoiceKey = invoiceIdempotencyKey({
      tenantId: 't1',
      subscriptionId: 'sub1',
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-08-01T00:00:00.000Z',
    });
    const payKey = paymentIdempotencyKey({
      gateway: 'PayChangu',
      gatewayReference: 'TX-ORPHAN',
    });
    const store = {
      invoices: [
        {
          id: 'inv-existing',
          idempotencyKey: invoiceKey,
          status: 'PAID',
          amountPaid: 50000,
          outstanding: 0,
          total: 50000,
        },
      ],
      payments: [
        {
          id: 'pay-orphan',
          idempotencyKey: payKey,
          invoiceId: null,
          status: 'COMPLETED',
          gatewayReference: 'TX-ORPHAN',
        },
      ],
    };
    const prisma = {
      platformInvoice: {
        findUnique: vi.fn(async ({ where }) =>
          store.invoices.find((i) => i.idempotencyKey === where.idempotencyKey) || null
        ),
        create: vi.fn(),
        update: vi.fn(async ({ where, data }) => {
          const row = store.invoices.find((i) => i.id === where.id);
          Object.assign(row, data);
          return row;
        }),
      },
      platformPayment: {
        findUnique: vi.fn(async ({ where }) => {
          if (where.idempotencyKey) {
            return store.payments.find((p) => p.idempotencyKey === where.idempotencyKey) || null;
          }
          return null;
        }),
        create: vi.fn(),
        update: vi.fn(async ({ where, data }) => {
          const row = store.payments.find((p) => p.id === where.id);
          Object.assign(row, data);
          return row;
        }),
      },
    };

    const result = await ensurePaychanguPlatformLedger(prisma, {
      tenantId: 't1',
      subscriptionId: 'sub1',
      periodStart: new Date('2026-07-01T00:00:00.000Z'),
      periodEnd: new Date('2026-08-01T00:00:00.000Z'),
      amount: 50000,
      currency: 'MWK',
      planCode: '1month',
      gatewayReference: 'TX-ORPHAN',
    });

    expect(result.ok).toBe(true);
    expect(result.createdInvoice).toBe(false);
    expect(result.createdPayment).toBe(false);
    expect(result.payment.invoiceId).toBe('inv-existing');
    expect(prisma.platformPayment.update).toHaveBeenCalled();
    expect(prisma.platformPayment.create).not.toHaveBeenCalled();
  });
});
