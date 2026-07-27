import { describe, it, expect } from 'vitest';
import {
  subscriptionPeriodKey,
  invoiceIdempotencyKey,
  paymentIdempotencyKey,
  allocatePayment,
  assertNoDuplicateActiveSubscription,
  reconcileInvoiceLine,
} from '@/lib/admin/platformBilling';
import {
  maskSettingsForClient,
  mergeSettings,
  SECRET_MASK,
} from '@/lib/admin/platformSettings';

describe('platformBilling helpers', () => {
  it('builds stable subscription period and invoice idempotency keys', () => {
    expect(
      subscriptionPeriodKey({
        subscriptionId: 'sub1',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
      })
    ).toBe('sub1:2026-01-01:2026-01-31');

    const a = invoiceIdempotencyKey({
      tenantId: 't1',
      subscriptionId: 's1',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
    });
    const b = invoiceIdempotencyKey({
      tenantId: 't1',
      subscriptionId: 's1',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(40);
  });

  it('derives payment idempotency from gateway reference', () => {
    expect(paymentIdempotencyKey({ gateway: 'paychangu', gatewayReference: '' })).toBeNull();
    const key = paymentIdempotencyKey({
      gateway: 'paychangu',
      gatewayReference: 'TX-99',
    });
    expect(key).toHaveLength(40);
    expect(
      paymentIdempotencyKey({ gateway: 'paychangu', gatewayReference: 'TX-99' })
    ).toBe(key);
  });

  it('allocates payments without overstating invoice paid status', () => {
    expect(allocatePayment({ invoiceOutstanding: 100, paymentAmount: 40 })).toEqual({
      ok: true,
      applied: 40,
      overpayment: 0,
      remaining: 60,
      invoiceStatus: 'PARTIALLY_PAID',
    });
    expect(allocatePayment({ invoiceOutstanding: 100, paymentAmount: 100 })).toMatchObject({
      ok: true,
      remaining: 0,
      invoiceStatus: 'PAID',
    });
    expect(allocatePayment({ invoiceOutstanding: 50, paymentAmount: 80 })).toMatchObject({
      ok: true,
      applied: 50,
      overpayment: 30,
      remaining: 0,
      invoiceStatus: 'PAID',
    });
    expect(allocatePayment({ invoiceOutstanding: 10, paymentAmount: 0 }).ok).toBe(false);
  });

  it('blocks duplicate active subscriptions', () => {
    expect(assertNoDuplicateActiveSubscription(0).ok).toBe(true);
    expect(assertNoDuplicateActiveSubscription(1).ok).toBe(false);
  });

  it('reconciles invoice line math', () => {
    expect(
      reconcileInvoiceLine({ subtotal: 100, discount: 10, tax: 5, total: 95 })
    ).toMatchObject({ ok: true, expected: 95, variance: 0 });
    expect(
      reconcileInvoiceLine({ subtotal: 100, discount: 0, tax: 0, total: 90 })
    ).toMatchObject({ ok: false, expected: 100, actual: 90 });
  });
});

describe('platformSettings secret masking', () => {
  it('masks set secrets and keeps empty secrets empty', () => {
    const masked = maskSettingsForClient({
      smtpHost: 'smtp.example.com',
      smtpPassword: 'super-secret',
      apiKey: '',
    });
    expect(masked.smtpHost).toBe('smtp.example.com');
    expect(masked.smtpPassword).toBe(SECRET_MASK);
    expect(masked.apiKey).toBe('');
  });

  it('keeps existing secrets when incoming secret is empty or masked', () => {
    const merged = mergeSettings(
      { smtpPassword: 'stored-secret', apiKey: 'key-1', appName: 'A' },
      { smtpPassword: '', apiKey: SECRET_MASK, appName: 'B' }
    );
    expect(merged.smtpPassword).toBe('stored-secret');
    expect(merged.apiKey).toBe('key-1');
    expect(merged.appName).toBe('B');
  });

  it('updates secrets only when a new non-empty value is provided', () => {
    const merged = mergeSettings(
      { smtpPassword: 'old' },
      { smtpPassword: 'new-password' }
    );
    expect(merged.smtpPassword).toBe('new-password');
  });
});
