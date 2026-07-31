/**
 * Reconcile analytics events/facts against operational sources.
 */

import { ANALYTICS_EVENT_TYPES } from './catalogue.js';

/**
 * Compare PLATFORM_PAYMENT_SUCCEEDED events to PlatformPayment COMPLETED rows.
 */
export async function reconcilePlatformPayments(db, { periodStart, periodEnd } = {}) {
  const start = periodStart ? new Date(periodStart) : new Date(Date.now() - 30 * 864e5);
  const end = periodEnd ? new Date(periodEnd) : new Date();

  const [ops, events] = await Promise.all([
    db.platformPayment.count({
      where: {
        status: { in: ['COMPLETED', 'Completed', 'completed'] },
        createdAt: { gte: start, lte: end },
      },
    }),
    db.analyticsEvent.count({
      where: {
        eventType: ANALYTICS_EVENT_TYPES.PLATFORM_PAYMENT_SUCCEEDED,
        occurredAt: { gte: start, lte: end },
      },
    }),
  ]);

  const variance = Number(ops) - Number(events);
  const status = variance === 0 ? 'MATCH' : 'MISMATCH';

  const run = await db.analyticsReconciliationRun.create({
    data: {
      checkKey: 'platform_payment_succeeded',
      periodStart: start,
      periodEnd: end,
      expected: ops,
      actual: events,
      variance,
      status,
      detail: {
        operationalModel: 'PlatformPayment',
        eventType: ANALYTICS_EVENT_TYPES.PLATFORM_PAYMENT_SUCCEEDED,
      },
    },
  });

  return { ok: true, status, expected: ops, actual: events, variance, run };
}

/**
 * Pure helper for unit tests without DB.
 */
export function evaluateReconciliation(expected, actual) {
  const variance = Number(expected) - Number(actual);
  return {
    status: variance === 0 ? 'MATCH' : 'MISMATCH',
    variance,
    expected: Number(expected),
    actual: Number(actual),
  };
}
