/**
 * Billed period totals from PlatformInvoice (status not void/cancelled), per currency.
 */

import {
  VOID_INVOICE_STATUSES,
  roundMoney,
  parseCurrencyOpt,
} from './billingConstants.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ periodStart: Date, periodEnd?: Date, currency?: string }} opts
 */
export async function computeBilledPeriod(prisma, opts = {}) {
  const { isCrossCurrency, currency, defaultCurrency } = parseCurrencyOpt(opts.currency);
  if (isCrossCurrency) {
    return {
      ok: false,
      reasonCode: 'fx_unavailable',
      message:
        'Cross-currency consolidation UNAVAILABLE without a certified FX rate source; request a single currency.',
      currency: 'ALL',
    };
  }
  if (typeof prisma?.platformInvoice?.aggregate !== 'function') {
    return {
      ok: false,
      reasonCode: 'query_failed',
      message: 'PlatformInvoice model unavailable',
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
      createdAt: { gte: periodStart, lte: periodEnd },
      status: { notIn: [...VOID_INVOICE_STATUSES] },
      currency: defaultCurrency,
    };
    const agg = await prisma.platformInvoice.aggregate({
      where,
      _sum: { total: true },
      _count: { _all: true },
    });
    const billedTotal = roundMoney(agg?._sum?.total);
    const invoiceCount = Number(agg?._count?._all) || 0;
    return {
      ok: true,
      currency: defaultCurrency,
      billedTotal,
      invoiceCount,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      limitations:
        'PlatformInvoice may be sparse vs PayChangu AccountSubscription path; void/cancelled excluded.',
    };
  } catch (e) {
    return {
      ok: false,
      reasonCode: 'query_failed',
      message: e?.message || 'PlatformInvoice query failed',
      currency: defaultCurrency,
    };
  }
}
