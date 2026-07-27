import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  assertPlanPriceChangeCreatesVersion,
  buildRenewalInvoiceRequest,
  nextBillingPeriod,
  assertRefundWithinPaid,
  applyCreditToInvoice,
  invoiceIdempotencyKey,
  creditIdempotencyKey,
  refundIdempotencyKey,
  isSuccessfulPaymentStatus,
} from '@/lib/admin/platformBilling';
import { ADMIN_NAV_SECTIONS } from '@/lib/admin/adminNav';

const root = process.cwd();

describe('Phase 3 — plan versioning', () => {
  it('requires new version on price change', () => {
    const blocked = assertPlanPriceChangeCreatesVersion({
      existingPrice: 50000,
      newPrice: 60000,
      forceNewVersion: false,
    });
    expect(blocked.ok).toBe(false);
    const allowed = assertPlanPriceChangeCreatesVersion({
      existingPrice: 50000,
      newPrice: 60000,
      forceNewVersion: true,
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.requiresNewVersion).toBe(true);
  });
});

describe('Phase 3 — renewal idempotency', () => {
  it('builds stable renewal keys for the same period', () => {
    const a = buildRenewalInvoiceRequest({
      tenantId: 't1',
      subscriptionId: 's1',
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2026-02-01T00:00:00.000Z',
      subtotal: 50000,
    });
    const b = buildRenewalInvoiceRequest({
      tenantId: 't1',
      subscriptionId: 's1',
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2026-02-01T00:00:00.000Z',
      subtotal: 50000,
    });
    expect(a.ok).toBe(true);
    expect(a.body.idempotencyKey).toBe(b.body.idempotencyKey);
    expect(a.body.idempotencyKey).toBe(
      invoiceIdempotencyKey({
        tenantId: 't1',
        subscriptionId: 's1',
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-02-01T00:00:00.000Z',
      })
    );
  });

  it('computes next monthly period', () => {
    const next = nextBillingPeriod({
      periodEnd: '2026-01-15T00:00:00.000Z',
      cycle: 'month',
    });
    expect(next.ok).toBe(true);
    expect(new Date(next.periodEnd).getMonth()).toBe(1);
  });
});

describe('Phase 3 — credits and refunds', () => {
  it('applies credit without exceeding outstanding', () => {
    const r = applyCreditToInvoice({ outstanding: 100, creditAmount: 40 });
    expect(r.ok).toBe(true);
    expect(r.applied).toBe(40);
    expect(r.remainingOutstanding).toBe(60);
  });

  it('blocks refunds beyond paid amount', () => {
    expect(
      assertRefundWithinPaid({ amountPaid: 100, alreadyRefunded: 80, refundAmount: 30 }).ok
    ).toBe(false);
    expect(
      assertRefundWithinPaid({ amountPaid: 100, alreadyRefunded: 20, refundAmount: 30 }).ok
    ).toBe(true);
  });

  it('produces stable credit/refund keys', () => {
    expect(
      creditIdempotencyKey({ tenantId: 't', invoiceId: 'i', amount: 10, reasonCode: 'x' })
    ).toHaveLength(40);
    expect(refundIdempotencyKey({ paymentId: 'p', amount: 5 })).toHaveLength(40);
  });
});

describe('Phase 3 — routes and nav', () => {
  it('treats COMPLETED and SUCCESSFUL as successful payment statuses', () => {
    expect(isSuccessfulPaymentStatus('COMPLETED')).toBe(true);
    expect(isSuccessfulPaymentStatus('SUCCESSFUL')).toBe(true);
    expect(isSuccessfulPaymentStatus('FAILED')).toBe(false);
  });

  it('billing nav includes plans, credits, reconciliation', () => {
    const billing = ADMIN_NAV_SECTIONS.find((s) => s.id === 'billing');
    const hrefs = billing.items[0].subItems.map((s) => s.href);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/insightbooks/billing/plans',
        '/insightbooks/billing/credits',
        '/insightbooks/billing/reconciliation',
      ])
    );
  });

  it('admin invoices API no longer queries tenant AR Invoice model', () => {
    const src = readFileSync(join(root, 'app/api/admin/invoices/route.js'), 'utf8');
    expect(src).toMatch(/platformInvoice/);
    expect(src).toMatch(/platform_billing/);
    expect(src).not.toMatch(/prisma\.invoice\.findMany/);
  });

  it('overview page uses platform-billing overview API (no fake revenue)', () => {
    const src = readFileSync(
      join(root, 'app/insightbooks/billing/overview/page.js'),
      'utf8'
    );
    expect(src).toMatch(/\/api\/admin\/platform-billing\/overview/);
    expect(src).not.toMatch(/totalRevenue:\s*1250000/);
  });

  it('phase 3 pages and APIs exist', () => {
    expect(existsSync(join(root, 'app/insightbooks/billing/plans/page.js'))).toBe(true);
    expect(existsSync(join(root, 'app/insightbooks/billing/credits/page.js'))).toBe(true);
    expect(existsSync(join(root, 'app/insightbooks/billing/reconciliation/page.js'))).toBe(
      true
    );
    expect(
      existsSync(join(root, 'app/api/admin/platform-billing/renewals/route.js'))
    ).toBe(true);
    expect(existsSync(join(root, 'app/api/admin/platform-billing/plans/route.js'))).toBe(
      true
    );
  });
});
