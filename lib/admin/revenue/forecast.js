/**
 * Deterministic renewal exposure (Phase 6 Wave 4).
 * Sum of estimated MRR for active paid subscriptions expiring within a horizon.
 * Scenarios = documented multipliers only — not predictive / ML revenue.
 */

import {
  normalizeAmountToMrr,
  activePaidSubscriptionWhere,
} from '@/lib/admin/saasBillingKpis';
import { roundMoney, parseCurrencyOpt } from './billingConstants.js';

/** Documented scenario multipliers (definitions / UI must label as non-predictive). */
export const FORECAST_SCENARIO_MULTIPLIERS = Object.freeze({
  conservative: 0.9,
  base: 1.0,
  optimistic: 1.1,
});

export const FORECAST_LABEL = 'deterministic renewal exposure';

/**
 * Pure helper — apply scenario multipliers to a base exposure amount.
 * @param {number} baseAmount
 * @param {{ conservative?: number, base?: number, optimistic?: number }} [multipliers]
 */
export function applyForecastScenarios(baseAmount, multipliers = FORECAST_SCENARIO_MULTIPLIERS) {
  const base = Number(baseAmount);
  if (!Number.isFinite(base)) {
    return {
      ok: false,
      reasonCode: 'invalid_base',
      scenarios: null,
    };
  }
  const m = {
    conservative: multipliers.conservative ?? 0.9,
    base: multipliers.base ?? 1.0,
    optimistic: multipliers.optimistic ?? 1.1,
  };
  return {
    ok: true,
    label: FORECAST_LABEL,
    multipliers: m,
    scenarios: {
      conservative: roundMoney(base * m.conservative),
      base: roundMoney(base * m.base),
      optimistic: roundMoney(base * m.optimistic),
    },
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ currency?: string, horizonDays?: number, now?: Date }} [opts]
 */
export async function computeRenewalExposure(prisma, opts = {}) {
  const now = opts.now || new Date();
  const horizonDays = Math.min(Math.max(Number(opts.horizonDays) || 90, 1), 365);
  const { isCrossCurrency, defaultCurrency } = parseCurrencyOpt(opts.currency);

  if (isCrossCurrency) {
    return {
      ok: false,
      reasonCode: 'fx_unavailable',
      message:
        'Cross-currency renewal exposure UNAVAILABLE without a certified FX rate source; request a single currency.',
      currency: null,
      horizonDays,
      exposureMrr: null,
      subscriptionCount: null,
      scenarios: null,
      label: FORECAST_LABEL,
    };
  }

  const currency = defaultCurrency;
  const horizonEnd = new Date(now.getTime() + horizonDays * 864e5);

  let rows = [];
  try {
    rows = await prisma.accountSubscription.findMany({
      where: {
        ...activePaidSubscriptionWhere(now),
        expiresAt: { gt: now, lte: horizonEnd },
      },
      select: {
        id: true,
        tenantId: true,
        plan: true,
        amount: true,
        currency: true,
        expiresAt: true,
      },
    });
  } catch (e) {
    return {
      ok: false,
      reasonCode: 'query_failed',
      message: e?.message || 'Subscription query failed',
      currency,
      horizonDays,
      exposureMrr: null,
      subscriptionCount: null,
      scenarios: null,
      label: FORECAST_LABEL,
    };
  }

  const filtered = (rows || []).filter(
    (r) => String(r.currency || 'MWK').toUpperCase() === currency
  );

  let exposureMrr = 0;
  const bySubscription = [];
  for (const row of filtered) {
    const mrr = normalizeAmountToMrr(row.amount, row.plan);
    if (!(mrr > 0)) continue;
    exposureMrr += mrr;
    bySubscription.push({
      subscriptionId: row.id,
      tenantId: row.tenantId,
      plan: row.plan,
      mrr: roundMoney(mrr),
      expiresAt: row.expiresAt,
    });
  }

  const rounded = roundMoney(exposureMrr);
  const scenarioResult = applyForecastScenarios(rounded);

  return {
    ok: true,
    reasonCode: null,
    message: null,
    currency,
    horizonDays,
    horizonEnd: horizonEnd.toISOString(),
    exposureMrr: rounded,
    subscriptionCount: bySubscription.length,
    bySubscription,
    scenarios: scenarioResult.scenarios,
    multipliers: scenarioResult.multipliers,
    label: FORECAST_LABEL,
    limitations:
      'Deterministic renewal exposure from expiresAt + active estimated MRR only. Scenarios apply fixed multipliers (0.9 / 1.0 / 1.1). Not predictive revenue; not ML; not GAAP.',
  };
}
