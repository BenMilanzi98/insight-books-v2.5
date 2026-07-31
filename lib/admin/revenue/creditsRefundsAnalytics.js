/**
 * Platform credits (open/issued) and refunds period sums.
 */

import {
  COMPLETED_REFUND_STATUSES,
  roundMoney,
  parseCurrencyOpt,
} from './billingConstants.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ periodStart: Date, periodEnd?: Date, currency?: string }} opts
 */
export async function computeCreditsRefunds(prisma, opts = {}) {
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

  const hasCredit = typeof prisma?.platformCredit?.aggregate === 'function';
  const hasRefund = typeof prisma?.platformRefund?.aggregate === 'function';
  if (!hasCredit && !hasRefund) {
    return {
      ok: false,
      reasonCode: 'query_failed',
      message: 'PlatformCredit / PlatformRefund models unavailable',
      currency: defaultCurrency,
    };
  }

  try {
    const [openAgg, issuedAgg, refundAgg] = await Promise.all([
      hasCredit
        ? prisma.platformCredit.aggregate({
            where: {
              currency: defaultCurrency,
              status: 'OPEN',
              remaining: { gt: 0 },
            },
            _sum: { remaining: true },
            _count: { _all: true },
          })
        : Promise.resolve(null),
      hasCredit
        ? prisma.platformCredit.aggregate({
            where: {
              currency: defaultCurrency,
              createdAt: { gte: periodStart, lte: periodEnd },
            },
            _sum: { amount: true },
            _count: { _all: true },
          })
        : Promise.resolve(null),
      hasRefund
        ? prisma.platformRefund.aggregate({
            where: {
              currency: defaultCurrency,
              status: { in: [...COMPLETED_REFUND_STATUSES] },
              createdAt: { gte: periodStart, lte: periodEnd },
            },
            _sum: { amount: true },
            _count: { _all: true },
          })
        : Promise.resolve(null),
    ]);

    if (!hasCredit || !hasRefund) {
      return {
        ok: false,
        reasonCode: 'query_failed',
        message: !hasCredit
          ? 'PlatformCredit model unavailable'
          : 'PlatformRefund model unavailable',
        currency: defaultCurrency,
      };
    }

    return {
      ok: true,
      currency: defaultCurrency,
      openCount: Number(openAgg?._count?._all) || 0,
      openRemaining: roundMoney(openAgg?._sum?.remaining),
      issuedPeriodTotal: roundMoney(issuedAgg?._sum?.amount),
      issuedPeriodCount: Number(issuedAgg?._count?._all) || 0,
      refundsPeriodTotal: roundMoney(refundAgg?._sum?.amount),
      refundsPeriodCount: Number(refundAgg?._count?._all) || 0,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      limitations: 'PlatformCredit / PlatformRefund only; never tenant AR adjustments.',
    };
  } catch (e) {
    return {
      ok: false,
      reasonCode: 'query_failed',
      message: e?.message || 'Credits/refunds query failed',
      currency: defaultCurrency,
    };
  }
}
