/**
 * Subscription start-month cohorts + retention (Phase 6 Wave 4).
 * Only when reconstruct confidence covers the cohort window; else UNAVAILABLE.
 */

import {
  normalizeAmountToMrr,
  activePaidSubscriptionWhere,
} from '@/lib/admin/saasBillingKpis';
import {
  reconstructMrrHistory,
  accessStartAt,
  subscriptionCoversDay,
  startOfUtcDay,
} from './reconstructMrr.js';
import { roundMoney, parseCurrencyOpt } from './billingConstants.js';

const MAX_RETENTION_MONTHS = 12;

function utcMonthKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function addUtcMonths(day, months) {
  const d = startOfUtcDay(day);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
}

function startOfUtcMonth(d) {
  const x = d instanceof Date ? d : new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), 1));
}

/**
 * Gate: reconstruct must cover window with usable confidence.
 * HIGH / MIXED → allow (MIXED → limitations). LOW / UNAVAILABLE → block.
 */
export function cohortConfidenceAllows(confidence) {
  return confidence === 'HIGH' || confidence === 'MIXED';
}

/**
 * Build cohort retention matrix from subscription rows (pure).
 * @param {object[]} rows
 * @param {{ now: Date, monthsBack: number, maxAgeMonths?: number }} opts
 */
export function buildCohortMatrix(rows, opts) {
  const now = opts.now || new Date();
  const monthsBack = Math.min(Math.max(Number(opts.monthsBack) || 6, 1), 24);
  const maxAge = Math.min(
    Math.max(Number(opts.maxAgeMonths) || MAX_RETENTION_MONTHS, 1),
    MAX_RETENTION_MONTHS
  );
  const windowStart = startOfUtcMonth(addUtcMonths(now, -(monthsBack - 1)));

  /** @type {Map<string, { members: object[], startMonth: string }>} */
  const cohorts = new Map();

  for (const row of rows || []) {
    const start = accessStartAt(row);
    if (!start || !row.expiresAt) continue;
    const startAt = start instanceof Date ? start : new Date(start);
    if (Number.isNaN(startAt.getTime()) || startAt < windowStart) continue;
    const key = utcMonthKey(startAt);
    if (!key) continue;
    if (!cohorts.has(key)) {
      cohorts.set(key, { members: [], startMonth: key });
    }
    const mrr = normalizeAmountToMrr(row.amount, row.plan);
    cohorts.get(key).members.push({
      id: row.id,
      tenantId: row.tenantId,
      startAt,
      expiresAt: row.expiresAt,
      amount: row.amount,
      plan: row.plan,
      mrr: mrr > 0 ? roundMoney(mrr) : 0,
      status: row.status,
      isActive: row.isActive,
    });
  }

  const cohortList = [...cohorts.keys()].sort().map((key) => {
    const { members } = cohorts.get(key);
    const size = members.length;
    const contractedMrr = roundMoney(members.reduce((a, m) => a + (m.mrr || 0), 0));
    const retentionByCount = [];
    const retentionByMrr = [];

    for (let age = 0; age <= maxAge; age += 1) {
      const asOf = addUtcMonths(startOfUtcMonth(`${key}-01T00:00:00Z`), age);
      if (asOf > now) {
        retentionByCount.push({ ageMonths: age, active: null, rate: null });
        retentionByMrr.push({ ageMonths: age, activeMrr: null, rate: null });
        continue;
      }
      let activeCount = 0;
      let activeMrr = 0;
      for (const m of members) {
        if (subscriptionCoversDay(m, asOf)) {
          activeCount += 1;
          activeMrr += m.mrr || 0;
        }
      }
      retentionByCount.push({
        ageMonths: age,
        active: activeCount,
        rate: size > 0 ? roundMoney(activeCount / size) : null,
      });
      retentionByMrr.push({
        ageMonths: age,
        activeMrr: roundMoney(activeMrr),
        rate: contractedMrr > 0 ? roundMoney(activeMrr / contractedMrr) : null,
      });
    }

    return {
      cohortMonth: key,
      size,
      contractedMrr,
      retentionByCount,
      retentionByMrr,
    };
  });

  return {
    windowStart: windowStart.toISOString(),
    monthsBack,
    cohorts: cohortList,
    thinHistory: cohortList.length === 0 || cohortList.every((c) => c.size < 2),
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ currency?: string, now?: Date, monthsBack?: number }} [opts]
 */
export async function computeSubscriptionCohorts(prisma, opts = {}) {
  const now = opts.now || new Date();
  const monthsBack = Math.min(Math.max(Number(opts.monthsBack) || 6, 1), 24);
  const { isCrossCurrency, defaultCurrency } = parseCurrencyOpt(opts.currency);

  if (isCrossCurrency) {
    return {
      ok: false,
      reasonCode: 'fx_unavailable',
      message:
        'Cross-currency cohorts UNAVAILABLE without a certified FX rate source; request a single currency.',
      currency: null,
      confidence: 'UNAVAILABLE',
      cohorts: null,
      retention: null,
    };
  }

  const currency = defaultCurrency;
  const windowStart = startOfUtcMonth(addUtcMonths(now, -(monthsBack - 1)));

  let reconstruct;
  try {
    reconstruct = await reconstructMrrHistory(prisma, {
      from: windowStart,
      to: now,
      currency,
    });
  } catch (e) {
    return {
      ok: false,
      reasonCode: 'query_failed',
      message: e?.message || 'Reconstruct failed',
      currency,
      confidence: 'UNAVAILABLE',
      cohorts: null,
      retention: null,
    };
  }

  if (!cohortConfidenceAllows(reconstruct.confidence)) {
    return {
      ok: false,
      reasonCode: 'insufficient_reconstruct_window',
      message:
        reconstruct.confidence === 'UNAVAILABLE'
          ? 'Cohorts UNAVAILABLE — reconstruct window insufficient or invalid.'
          : `Cohorts UNAVAILABLE — reconstruct confidence is ${reconstruct.confidence}; need HIGH or MIXED covering the cohort window.`,
      currency,
      confidence: reconstruct.confidence,
      gaps: reconstruct.gaps,
      cohorts: null,
      retention: null,
    };
  }

  let rows = [];
  try {
    rows = await prisma.accountSubscription.findMany({
      where: {
        isTrial: false,
        currency: { equals: currency, mode: 'insensitive' },
        OR: [
          { startedAt: { gte: windowStart } },
          { paymentDate: { gte: windowStart } },
          { createdAt: { gte: windowStart } },
        ],
      },
      select: {
        id: true,
        tenantId: true,
        plan: true,
        amount: true,
        currency: true,
        status: true,
        isActive: true,
        isTrial: true,
        startedAt: true,
        paymentDate: true,
        createdAt: true,
        expiresAt: true,
      },
    });
  } catch {
    try {
      rows = await prisma.accountSubscription.findMany({
        where: {
          isTrial: false,
          currency,
          OR: [
            { startedAt: { gte: windowStart } },
            { paymentDate: { gte: windowStart } },
            { createdAt: { gte: windowStart } },
          ],
        },
        select: {
          id: true,
          tenantId: true,
          plan: true,
          amount: true,
          currency: true,
          status: true,
          isActive: true,
          isTrial: true,
          startedAt: true,
          paymentDate: true,
          createdAt: true,
          expiresAt: true,
        },
      });
    } catch (err) {
      return {
        ok: false,
        reasonCode: 'query_failed',
        message: err?.message || 'Subscription query failed',
        currency,
        confidence: reconstruct.confidence,
        cohorts: null,
        retention: null,
      };
    }
  }

  rows = (rows || []).filter((r) => String(r.currency || '').toUpperCase() === currency);

  const matrix = buildCohortMatrix(rows, { now, monthsBack });

  if (matrix.thinHistory) {
    return {
      ok: false,
      reasonCode: 'thin_history',
      message:
        'Cohorts UNAVAILABLE — history too thin for meaningful start-month retention (need ≥2 members in at least one cohort).',
      currency,
      confidence: reconstruct.confidence,
      gaps: reconstruct.gaps,
      cohorts: null,
      retention: null,
    };
  }

  // Summary retention: latest complete age-1 rate across cohorts (count + MRR)
  const retentionSummary = {
    byCount: matrix.cohorts.map((c) => ({
      cohortMonth: c.cohortMonth,
      size: c.size,
      rates: c.retentionByCount.map((r) => ({ ageMonths: r.ageMonths, rate: r.rate })),
    })),
    byMrr: matrix.cohorts.map((c) => ({
      cohortMonth: c.cohortMonth,
      contractedMrr: c.contractedMrr,
      rates: c.retentionByMrr.map((r) => ({ ageMonths: r.ageMonths, rate: r.rate })),
    })),
  };

  return {
    ok: true,
    reasonCode: null,
    message: null,
    currency,
    confidence: reconstruct.confidence,
    gaps: reconstruct.gaps,
    windowStart: matrix.windowStart,
    monthsBack: matrix.monthsBack,
    cohorts: matrix.cohorts,
    retention: retentionSummary,
    limitations:
      reconstruct.confidence === 'MIXED'
        ? 'Cohorts READY_WITH_LIMITATIONS — reconstruct confidence MIXED over the window. Retention uses subscription cover dates (startedAt/paymentDate/createdAt → expiresAt).'
        : 'Start-month cohorts from subscription access start; retention by count and contracted MRR still covering month N. Platform subscriptions only.',
  };
}

/**
 * Plan mix from active paid estimated MRR (subscriptions/plans UI helper).
 */
export async function computePlanPerformance(prisma, opts = {}) {
  const now = opts.now || new Date();
  const { isCrossCurrency, defaultCurrency } = parseCurrencyOpt(opts.currency);

  if (isCrossCurrency) {
    return {
      ok: false,
      reasonCode: 'fx_unavailable',
      message:
        'Cross-currency plan performance UNAVAILABLE without FX; request a single currency.',
      currency: null,
      plans: null,
    };
  }

  const currency = defaultCurrency;
  let rows = [];
  try {
    rows = await prisma.accountSubscription.findMany({
      where: activePaidSubscriptionWhere(now),
      select: {
        id: true,
        tenantId: true,
        plan: true,
        amount: true,
        currency: true,
      },
    });
  } catch (e) {
    return {
      ok: false,
      reasonCode: 'query_failed',
      message: e?.message || 'Subscription query failed',
      currency,
      plans: null,
    };
  }

  const byPlan = new Map();
  for (const row of rows || []) {
    if (String(row.currency || 'MWK').toUpperCase() !== currency) continue;
    const mrr = normalizeAmountToMrr(row.amount, row.plan);
    if (!(mrr > 0)) continue;
    const plan = row.plan || 'unknown';
    const cur = byPlan.get(plan) || { plan, subscriptionCount: 0, mrr: 0, tenantIds: new Set() };
    cur.subscriptionCount += 1;
    cur.mrr += mrr;
    if (row.tenantId) cur.tenantIds.add(row.tenantId);
    byPlan.set(plan, cur);
  }

  const plans = [...byPlan.values()]
    .map((p) => ({
      plan: p.plan,
      subscriptionCount: p.subscriptionCount,
      tenantCount: p.tenantIds.size,
      estimatedMrr: roundMoney(p.mrr),
    }))
    .sort((a, b) => b.estimatedMrr - a.estimatedMrr);

  return {
    ok: true,
    currency,
    plans,
    limitations: 'Active paid estimated MRR grouped by plan code. Not recognised revenue.',
  };
}
