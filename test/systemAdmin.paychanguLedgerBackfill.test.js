import { describe, it, expect } from 'vitest';
import {
  planPaychanguLedgerBackfill,
  shouldBackfillSubscription,
} from '@/lib/admin/paychanguLedgerBackfill';
import { invoiceIdempotencyKey } from '@/lib/admin/platformBilling';

describe('PayChangu ledger backfill planning', () => {
  it('shouldBackfillSubscription requires paid completed-like sub with period', () => {
    expect(
      shouldBackfillSubscription({
        id: 's1',
        tenantId: 't1',
        status: 'Completed',
        isActive: true,
        isTrial: false,
        amount: 50000,
        startedAt: new Date('2026-01-01'),
        expiresAt: new Date('2026-02-01'),
        txRef: 'TX1',
      })
    ).toBe(true);

    expect(
      shouldBackfillSubscription({
        id: 's2',
        tenantId: 't1',
        status: 'Pending',
        isActive: false,
        amount: 50000,
        startedAt: new Date('2026-01-01'),
        expiresAt: new Date('2026-02-01'),
        txRef: 'TX2',
      })
    ).toBe(false);
  });

  it('plans create_ledger for missing invoices and skips complete rows', () => {
    const periodStart = '2026-01-01T00:00:00.000Z';
    const periodEnd = '2026-02-01T00:00:00.000Z';
    const key = invoiceIdempotencyKey({
      tenantId: 't1',
      subscriptionId: 's1',
      periodStart,
      periodEnd,
    });

    const plan = planPaychanguLedgerBackfill({
      subscriptions: [
        {
          id: 's1',
          source: 'account',
          tenantId: 't1',
          plan: '1month',
          status: 'Completed',
          isActive: true,
          isTrial: false,
          amount: 50000,
          currency: 'MWK',
          startedAt: periodStart,
          expiresAt: periodEnd,
          paymentDate: periodStart,
          txRef: 'TX-1',
        },
        {
          id: 's2',
          source: 'account',
          tenantId: 't1',
          plan: '1year',
          status: 'Completed',
          isActive: true,
          isTrial: false,
          amount: 300000,
          currency: 'MWK',
          startedAt: periodStart,
          expiresAt: '2027-01-01T00:00:00.000Z',
          paymentDate: periodStart,
          txRef: 'TX-2',
        },
      ],
      existingInvoiceKeys: new Set([key]),
      orphanPaymentsByTxRef: new Map(),
      paymentRefs: new Set(['TX-1']),
    });

    expect(plan.actions.map((a) => a.subscriptionId)).toEqual(['s2']);
    expect(plan.actions[0].action).toBe('create_ledger');
    expect(
      plan.skipped.some((s) => s.subscriptionId === 's1' && s.reason === 'complete')
    ).toBe(true);
  });

  it('plans link_orphan when invoice exists but payment is unlinked', () => {
    const periodStart = '2026-01-01T00:00:00.000Z';
    const periodEnd = '2026-02-01T00:00:00.000Z';
    const key = invoiceIdempotencyKey({
      tenantId: 't1',
      subscriptionId: 's1',
      periodStart,
      periodEnd,
    });

    const plan = planPaychanguLedgerBackfill({
      subscriptions: [
        {
          id: 's1',
          source: 'account',
          tenantId: 't1',
          plan: '1month',
          status: 'Completed',
          isTrial: false,
          amount: 50000,
          currency: 'MWK',
          startedAt: periodStart,
          expiresAt: periodEnd,
          txRef: 'TX-ORPHAN',
        },
      ],
      existingInvoiceKeys: new Set([key]),
      orphanPaymentsByTxRef: new Map([
        ['TX-ORPHAN', { id: 'pay-1', gatewayReference: 'TX-ORPHAN', invoiceId: null }],
      ]),
      paymentRefs: new Set(['TX-ORPHAN']),
    });

    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0].action).toBe('link_orphan');
    expect(plan.actions[0].orphanPaymentId).toBe('pay-1');
    expect(plan.unmatchedOrphans).toHaveLength(0);
  });

  it('plans create_payment when invoice exists but no payment row', () => {
    const periodStart = '2026-01-01T00:00:00.000Z';
    const periodEnd = '2026-02-01T00:00:00.000Z';
    const key = invoiceIdempotencyKey({
      tenantId: 't1',
      subscriptionId: 's1',
      periodStart,
      periodEnd,
    });

    const plan = planPaychanguLedgerBackfill({
      subscriptions: [
        {
          id: 's1',
          source: 'branch',
          tenantId: 't1',
          plan: 'branch-month',
          status: 'Completed',
          amount: 25000,
          currency: 'MWK',
          startedAt: periodStart,
          expiresAt: periodEnd,
          txRef: 'TX-BRANCH',
        },
      ],
      existingInvoiceKeys: new Set([key]),
      orphanPaymentsByTxRef: new Map(),
      paymentRefs: new Set(),
    });

    expect(plan.actions[0]).toMatchObject({
      action: 'create_payment',
      source: 'branch',
      subscriptionId: 's1',
    });
  });

  it('reports unmatched orphan payments with no subscription', () => {
    const plan = planPaychanguLedgerBackfill({
      subscriptions: [],
      existingInvoiceKeys: new Set(),
      orphanPaymentsByTxRef: new Map([
        [
          'TX-GHOST',
          { id: 'pay-x', tenantId: 't9', gatewayReference: 'TX-GHOST', amount: 10 },
        ],
      ]),
      paymentRefs: new Set(['TX-GHOST']),
    });

    expect(plan.actions).toHaveLength(0);
    expect(plan.unmatchedOrphans).toEqual([
      expect.objectContaining({
        paymentId: 'pay-x',
        gatewayReference: 'TX-GHOST',
        reason: 'no_matching_subscription',
      }),
    ]);
  });
});
