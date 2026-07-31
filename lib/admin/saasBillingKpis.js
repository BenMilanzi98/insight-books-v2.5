/**
 * SaaS billing KPI helpers for the platform control plane.
 * Source of truth: AccountSubscription + PlatformPayment (+ PlatformInvoice when present).
 * NEVER aggregates Tenant Sale / Expense / Invoice (tenant AR).
 */

import { getSubscriptionPlan } from '@/lib/subscriptionConfig';

/** Status values that mean "not commercially active". */
export const INACTIVE_STATUSES = Object.freeze([
  'cancelled',
  'Cancelled',
  'CANCELLED',
  'pending',
  'Pending',
  'PENDING',
  'processing',
  'Expired',
  'expired',
  'EXPIRED',
]);

/**
 * Prisma where-clause for paid, non-expired, active AccountSubscription rows.
 * Includes PayChangu `Completed` status (not only `active`).
 */
export function activePaidSubscriptionWhere(now = new Date()) {
  return {
    isActive: true,
    isTrial: false,
    expiresAt: { gt: now },
    status: { notIn: [...INACTIVE_STATUSES] },
  };
}

/**
 * Active commercial access including in-trial (for seat-style counts).
 */
export function activeCommercialSubscriptionWhere(now = new Date()) {
  return {
    OR: [
      activePaidSubscriptionWhere(now),
      {
        isTrial: true,
        trialEndDate: { gt: now },
        status: { notIn: ['Expired', 'expired', 'EXPIRED', 'cancelled', 'Cancelled'] },
      },
    ],
  };
}

/**
 * Normalize a charged amount to approximate monthly recurring units.
 * Uses catalog plan.period when known; falls back to treating amount as monthly.
 */
export function normalizeAmountToMrr(amount, planCode) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return 0;
  const plan = getSubscriptionPlan(planCode);
  const period = plan?.period || 'month';
  if (period === 'year') return amt / 12;
  if (period === 'quarter' || planCode === '3months') return amt / 3;
  return amt;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ periodStart?: Date, currency?: string }} [opts]
 *   Optional `currency` filters PlatformPayment aggregates (and labels the result).
 *   Omitted/null preserves Phase 5 default behavior (unfiltered sum, currency label MWK).
 */
export async function computeSaasBillingKpis(prisma, opts = {}) {
  const now = new Date();
  const periodStart =
    opts.periodStart || new Date(now.getFullYear(), now.getMonth(), 1);
  const currencyFilter =
    opts.currency && opts.currency !== 'ALL' && opts.currency !== '*'
      ? String(opts.currency).toUpperCase()
      : null;

  const paymentBaseWhere = {
    status: { in: ['COMPLETED', 'SUCCESSFUL', 'FULLY_ALLOCATED'] },
    ...(currencyFilter ? { currency: currencyFilter } : {}),
  };

  const [activePaidRows, trialCount, paymentsPeriod, paymentsAll, openCredits] =
    await Promise.all([
      prisma.accountSubscription.findMany({
        where: activePaidSubscriptionWhere(now),
        select: {
          id: true,
          tenantId: true,
          plan: true,
          amount: true,
          currency: true,
          status: true,
        },
      }),
      prisma.accountSubscription.count({
        where: {
          isTrial: true,
          trialEndDate: { gt: now },
          status: { notIn: ['Expired', 'expired', 'EXPIRED'] },
        },
      }),
      prisma.platformPayment.aggregate({
        where: {
          ...paymentBaseWhere,
          createdAt: { gte: periodStart },
        },
        _sum: { amount: true },
      }),
      prisma.platformPayment.aggregate({
        where: paymentBaseWhere,
        _sum: { amount: true },
      }),
      prisma.platformCredit
        ? prisma.platformCredit.count({
            where: { status: 'OPEN', remaining: { gt: 0 } },
          })
        : Promise.resolve(0),
    ]);

  const tenantIds = new Set();
  let estimatedMrr = 0;
  let activeSubscriptionRows = 0;
  for (const row of activePaidRows) {
    if (
      currencyFilter &&
      String(row.currency || '').toUpperCase() !== currencyFilter
    ) {
      continue;
    }
    tenantIds.add(row.tenantId);
    estimatedMrr += normalizeAmountToMrr(row.amount, row.plan);
    activeSubscriptionRows += 1;
  }

  const paymentsCollectedThisPeriod = Number(paymentsPeriod?._sum?.amount) || 0;
  const paymentsCollectedAllTime = Number(paymentsAll?._sum?.amount) || 0;

  return {
    source: 'saas_billing_kpis',
    // Backward compatible: no currency opt → MWK label (Phase 5 callers)
    currency: currencyFilter || 'MWK',
    checkedAt: now.toISOString(),
    periodStart: periodStart.toISOString(),
    activeSubscriptionRows,
    distinctActivePaidTenants: tenantIds.size,
    trialSubscriptions: trialCount,
    estimatedMrr: Math.round(estimatedMrr * 100) / 100,
    paymentsCollectedThisPeriod,
    paymentsCollectedAllTime,
    openCreditsCount: openCredits,
    caveats: [
      'estimatedMrr normalizes yearly charges /12 using catalog plan.period',
      'CORE + EIS coexistence can yield two active rows per tenant',
      'PlatformInvoice may be sparse vs PayChangu AccountSubscription path',
      'Never includes Tenant Sale/Expense/Invoice totals',
      ...(currencyFilter
        ? [`PlatformPayment aggregates filtered to currency ${currencyFilter}`]
        : [
            'PlatformPayment aggregates are unfiltered across currencies; label MWK is conventional only',
          ]),
    ],
  };
}
