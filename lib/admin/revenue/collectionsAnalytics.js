/**
 * Collected period totals from PlatformPayment successful statuses
 * (aligned with saasBillingKpis: COMPLETED, SUCCESSFUL, FULLY_ALLOCATED).
 */

import {
  SUCCESSFUL_PAYMENT_STATUSES,
  roundMoney,
  parseCurrencyOpt,
} from './billingConstants.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ periodStart: Date, periodEnd?: Date, currency?: string }} opts
 */
export async function computeCollectedPeriod(prisma, opts = {}) {
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
  if (typeof prisma?.platformPayment?.aggregate !== 'function') {
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
    const where = {
      status: { in: [...SUCCESSFUL_PAYMENT_STATUSES] },
      currency: defaultCurrency,
      createdAt: { gte: periodStart, lte: periodEnd },
    };
    const agg = await prisma.platformPayment.aggregate({
      where,
      _sum: { amount: true },
      _count: { _all: true },
    });
    return {
      ok: true,
      currency: defaultCurrency,
      collectedTotal: roundMoney(agg?._sum?.amount),
      paymentCount: Number(agg?._count?._all) || 0,
      successfulStatuses: [...SUCCESSFUL_PAYMENT_STATUSES],
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      limitations:
        'Successful PlatformPayment statuses match saasBillingKpis; reconcile vs invoice path.',
    };
  } catch (e) {
    return {
      ok: false,
      reasonCode: 'query_failed',
      message: e?.message || 'PlatformPayment query failed',
      currency: defaultCurrency,
    };
  }
}
