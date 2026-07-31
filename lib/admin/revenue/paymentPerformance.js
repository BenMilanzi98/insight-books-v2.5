/**
 * Payment success/failure counts and rates from PlatformPayment.status.
 * Retry analytics → NOT_SUPPORTED (no platform retry model).
 */

import {
  SUCCESSFUL_PAYMENT_STATUSES,
  FAILED_PAYMENT_STATUSES,
  parseCurrencyOpt,
} from './billingConstants.js';
import {
  METRIC_STATUS,
  unavailableMetric,
} from '@/lib/admin/intelligence/metricStates.js';
import { REVENUE_KPI_CODES, getRevenueDefinition } from './metricCatalogue.js';

/** @returns {object} */
export function retryAnalyticsUnavailable() {
  const d = getRevenueDefinition(REVENUE_KPI_CODES.PAYMENT_RETRY_ANALYTICS);
  return unavailableMetric(
    REVENUE_KPI_CODES.PAYMENT_RETRY_ANALYTICS,
    'Payment retry analytics NOT_SUPPORTED — no platform retry model.',
    {
      status: METRIC_STATUS.NOT_SUPPORTED,
      reasonCode: 'not_supported',
      label: d.label,
      definition: d.definition,
      source: d.source,
    }
  );
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ periodStart: Date, periodEnd?: Date, currency?: string }} opts
 */
export async function computePaymentPerformance(prisma, opts = {}) {
  const { isCrossCurrency, defaultCurrency } = parseCurrencyOpt(opts.currency);
  if (isCrossCurrency) {
    return {
      ok: false,
      reasonCode: 'fx_unavailable',
      message:
        'Cross-currency consolidation UNAVAILABLE without a certified FX rate source; request a single currency.',
      currency: 'ALL',
    };
  }
  if (typeof prisma?.platformPayment?.findMany !== 'function') {
    return {
      ok: false,
      reasonCode: 'query_failed',
      message: 'PlatformPayment model unavailable',
      currency: defaultCurrency,
    };
  }

  const periodStart = opts.periodStart;
  const periodEnd = opts.periodEnd || new Date();
  if (!periodStart) {
    return {
      ok: false,
      reasonCode: 'incomplete',
      message: 'periodStart required',
      currency: defaultCurrency,
    };
  }

  try {
    const rows = await prisma.platformPayment.findMany({
      where: {
        currency: defaultCurrency,
        createdAt: { gte: periodStart, lte: periodEnd },
        status: {
          in: [...SUCCESSFUL_PAYMENT_STATUSES, ...FAILED_PAYMENT_STATUSES],
        },
      },
      select: { id: true, status: true, amount: true },
    });

    let successCount = 0;
    let failureCount = 0;
    for (const row of rows || []) {
      const st = String(row.status || '').toUpperCase();
      if (SUCCESSFUL_PAYMENT_STATUSES.includes(st)) successCount += 1;
      else if (FAILED_PAYMENT_STATUSES.includes(st)) failureCount += 1;
    }

    const decided = successCount + failureCount;
    const successRate =
      decided > 0 ? Math.round((successCount / decided) * 10000) / 10000 : null;
    const failureRate =
      decided > 0 ? Math.round((failureCount / decided) * 10000) / 10000 : null;

    return {
      ok: true,
      currency: defaultCurrency,
      successCount,
      failureCount,
      decidedCount: decided,
      successRate,
      failureRate,
      ratesAvailable: decided > 0,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      limitations:
        'Rates use success+failure denominator only; pending/other statuses excluded. Retries NOT_SUPPORTED.',
    };
  } catch (e) {
    return {
      ok: false,
      reasonCode: 'query_failed',
      message: e?.message || 'Payment performance query failed',
      currency: defaultCurrency,
    };
  }
}
