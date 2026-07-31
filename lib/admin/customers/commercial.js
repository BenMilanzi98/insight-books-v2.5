/**
 * Per-tenant commercial summary — AccountSubscription + PlatformInvoice/Payment.
 * Never uses Tenant Sale. Currency ALL → money UNAVAILABLE (no FX).
 */

import {
  normalizeAmountToMrr,
  INACTIVE_STATUSES,
} from '@/lib/admin/saasBillingKpis';
import {
  SUCCESSFUL_PAYMENT_STATUSES,
  VOID_INVOICE_STATUSES,
  roundMoney,
  parseCurrencyOpt,
} from '@/lib/admin/revenue/billingConstants.js';
import {
  METRIC_STATUS,
  metricEnvelope,
  unavailableMetric,
} from '@/lib/admin/intelligence/metricStates.js';
import { CUSTOMER_METRIC_CODES, CUSTOMER_READINESS } from './catalogue.js';

const COMMERCIAL_LIMITATIONS =
  'Approximate MRR (yearly ÷ 12); CORE+EIS rows may coexist; PlatformInvoice may be sparse vs PayChangu AccountSubscription path. Platform billing only — excludes tenant POS/GL revenue.';

function moneyEnvelope(code, value, { currency, masked, status } = {}) {
  return metricEnvelope({
    code,
    status: status || METRIC_STATUS.READY_WITH_LIMITATIONS,
    value,
    unit: 'money',
    currency: currency || 'MWK',
    label: code,
    source: 'AccountSubscription / PlatformInvoice / PlatformPayment',
    limitations: COMMERCIAL_LIMITATIONS,
    masked: Boolean(masked),
  });
}

function forbidMoney(code) {
  return unavailableMetric(code, 'Insufficient finance metric permission', {
    status: METRIC_STATUS.FORBIDDEN,
    reasonCode: 'forbidden',
    unit: 'money',
  });
}

function fxUnavailableMoney(code) {
  return unavailableMetric(
    code,
    'Cross-currency consolidation UNAVAILABLE without a certified FX rate source; request a single currency.',
    {
      status: METRIC_STATUS.UNAVAILABLE,
      reasonCode: 'fx_unavailable',
      unit: 'money',
    }
  );
}

/**
 * Load raw commercial facts for one tenant (no auth).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {{ currency?: string, now?: Date }} [opts]
 */
export async function loadTenantCommercial(prisma, tenantId, opts = {}) {
  const now = opts.now || new Date();
  const { isCrossCurrency, defaultCurrency } = parseCurrencyOpt(opts.currency);

  if (!tenantId) {
    return {
      ok: false,
      reasonCode: 'tenant_required',
      message: 'tenantId required',
      currency: defaultCurrency,
    };
  }

  if (isCrossCurrency) {
    return {
      ok: false,
      reasonCode: 'fx_unavailable',
      message:
        'Cross-currency commercial money UNAVAILABLE without a certified FX rate source.',
      currency: 'ALL',
      isCrossCurrency: true,
    };
  }

  const currency = defaultCurrency;

  // Fail closed: missing billing clients must not coerce billed/collected/outstanding → 0
  // (same pattern as Phase 6 billingAnalytics.computeBilledPeriod).
  if (typeof prisma?.platformInvoice?.aggregate !== 'function') {
    return {
      ok: false,
      reasonCode: 'query_failed',
      message: 'PlatformInvoice model unavailable',
      currency,
    };
  }
  if (typeof prisma?.platformPayment?.aggregate !== 'function') {
    return {
      ok: false,
      reasonCode: 'query_failed',
      message: 'PlatformPayment model unavailable',
      currency,
    };
  }

  try {
    const [subs, invoiceAgg, paymentAgg, openOutstanding] = await Promise.all([
      prisma.accountSubscription.findMany({
        where: { tenantId },
        select: {
          id: true,
          plan: true,
          amount: true,
          currency: true,
          status: true,
          isActive: true,
          isTrial: true,
          startedAt: true,
          expiresAt: true,
          trialStartDate: true,
          trialEndDate: true,
          updatedAt: true,
          createdAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.platformInvoice.aggregate({
        where: {
          tenantId,
          currency,
          status: { notIn: [...VOID_INVOICE_STATUSES] },
        },
        _sum: { total: true, outstanding: true },
      }),
      prisma.platformPayment.aggregate({
        where: {
          tenantId,
          currency,
          status: { in: [...SUCCESSFUL_PAYMENT_STATUSES] },
        },
        _sum: { amount: true },
      }),
      prisma.platformInvoice.aggregate({
        where: {
          tenantId,
          currency,
          status: { notIn: [...VOID_INVOICE_STATUSES] },
          outstanding: { gt: 0 },
        },
        _sum: { outstanding: true },
      }),
    ]);

    const currencySubs = (subs || []).filter(
      (s) => String(s.currency || 'MWK').toUpperCase() === currency
    );

    let mrr = 0;
    let primary = null;

    for (const row of currencySubs) {
      const matchesPaid =
        row.isActive &&
        !row.isTrial &&
        row.expiresAt &&
        new Date(row.expiresAt) > now &&
        !INACTIVE_STATUSES.includes(row.status);
      if (matchesPaid) {
        mrr += normalizeAmountToMrr(row.amount, row.plan);
        if (!primary) primary = row;
      }
    }

    if (!primary) {
      primary =
        currencySubs.find(
          (s) =>
            s.isTrial &&
            s.trialEndDate &&
            new Date(s.trialEndDate) > now &&
            !['Expired', 'expired', 'EXPIRED', 'cancelled', 'Cancelled'].includes(s.status)
        ) ||
        currencySubs[0] ||
        (subs || [])[0] ||
        null;
    }

    const billed = roundMoney(invoiceAgg?._sum?.total);
    const collected = roundMoney(paymentAgg?._sum?.amount);
    const outstanding = roundMoney(
      openOutstanding?._sum?.outstanding ?? invoiceAgg?._sum?.outstanding
    );

    return {
      ok: true,
      currency,
      plan: primary?.plan || null,
      subscriptionStatus: primary?.status || null,
      renewalDate: primary?.expiresAt ? new Date(primary.expiresAt).toISOString() : null,
      mrr: roundMoney(mrr),
      arr: roundMoney(mrr * 12),
      billed,
      collected,
      outstanding,
      hasOutstanding: Number(outstanding) > 0,
      subscriptions: subs || [],
      activeSubscription: primary,
      limitations: COMMERCIAL_LIMITATIONS,
    };
  } catch (e) {
    return {
      ok: false,
      reasonCode: 'query_failed',
      message: e?.message || 'Commercial query failed',
      currency,
    };
  }
}

/**
 * Build commercial section with finance gating / masking / FX policy.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {{
 *   currency?: string,
 *   now?: Date,
 *   financeOk?: boolean,
 *   financeMasked?: boolean,
 * }} [opts]
 */
export async function buildCommercialSection(prisma, tenantId, opts = {}) {
  const financeOk = opts.financeOk !== false;
  const financeMasked = Boolean(opts.financeMasked);
  const { isCrossCurrency, defaultCurrency } = parseCurrencyOpt(opts.currency);

  if (!financeOk) {
    return {
      plan: null,
      subscriptionStatus: null,
      currency: null,
      mrr: null,
      arr: null,
      billed: null,
      collected: null,
      outstanding: null,
      renewalDate: null,
      status: CUSTOMER_READINESS.FORBIDDEN,
      _envelope: {
        [CUSTOMER_METRIC_CODES.MRR]: forbidMoney(CUSTOMER_METRIC_CODES.MRR),
        [CUSTOMER_METRIC_CODES.ARR]: forbidMoney(CUSTOMER_METRIC_CODES.ARR),
        [CUSTOMER_METRIC_CODES.BILLED]: forbidMoney(CUSTOMER_METRIC_CODES.BILLED),
        [CUSTOMER_METRIC_CODES.COLLECTED]: forbidMoney(CUSTOMER_METRIC_CODES.COLLECTED),
        [CUSTOMER_METRIC_CODES.OUTSTANDING]: forbidMoney(CUSTOMER_METRIC_CODES.OUTSTANDING),
      },
      subscriptions: [],
      activeSubscription: null,
      hasOutstanding: false,
    };
  }

  if (isCrossCurrency) {
    // Still load subscription rows for lifecycle / plan labels; money stays UNAVAILABLE.
    let subscriptions = [];
    let activeSubscription = null;
    try {
      subscriptions = await prisma.accountSubscription.findMany({
        where: { tenantId },
        select: {
          id: true,
          plan: true,
          amount: true,
          currency: true,
          status: true,
          isActive: true,
          isTrial: true,
          startedAt: true,
          expiresAt: true,
          trialStartDate: true,
          trialEndDate: true,
          updatedAt: true,
          createdAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      });
      activeSubscription = subscriptions[0] || null;
    } catch {
      subscriptions = [];
      activeSubscription = null;
    }

    return {
      plan: activeSubscription?.plan || null,
      subscriptionStatus: activeSubscription?.status || null,
      currency: 'ALL',
      mrr: null,
      arr: null,
      billed: null,
      collected: null,
      outstanding: null,
      renewalDate: activeSubscription?.expiresAt
        ? new Date(activeSubscription.expiresAt).toISOString()
        : null,
      status: CUSTOMER_READINESS.UNAVAILABLE,
      reason: 'fx_unavailable',
      _envelope: {
        [CUSTOMER_METRIC_CODES.MRR]: fxUnavailableMoney(CUSTOMER_METRIC_CODES.MRR),
        [CUSTOMER_METRIC_CODES.ARR]: fxUnavailableMoney(CUSTOMER_METRIC_CODES.ARR),
        [CUSTOMER_METRIC_CODES.BILLED]: fxUnavailableMoney(CUSTOMER_METRIC_CODES.BILLED),
        [CUSTOMER_METRIC_CODES.COLLECTED]: fxUnavailableMoney(
          CUSTOMER_METRIC_CODES.COLLECTED
        ),
        [CUSTOMER_METRIC_CODES.OUTSTANDING]: fxUnavailableMoney(
          CUSTOMER_METRIC_CODES.OUTSTANDING
        ),
      },
      subscriptions,
      activeSubscription,
      hasOutstanding: false,
      limitations:
        'Money UNAVAILABLE for currency=ALL (no FX). Subscription metadata may still be present.',
    };
  }

  const raw = await loadTenantCommercial(prisma, tenantId, {
    currency: opts.currency || defaultCurrency,
    now: opts.now,
  });

  if (!raw.ok) {
    const msg = raw.message || 'Commercial unavailable';
    return {
      plan: null,
      subscriptionStatus: null,
      currency: raw.currency || defaultCurrency,
      mrr: null,
      arr: null,
      billed: null,
      collected: null,
      outstanding: null,
      renewalDate: null,
      status: CUSTOMER_READINESS.UNAVAILABLE,
      reason: raw.reasonCode || 'query_failed',
      _envelope: {
        [CUSTOMER_METRIC_CODES.MRR]: unavailableMetric(CUSTOMER_METRIC_CODES.MRR, msg, {
          status: METRIC_STATUS.UNAVAILABLE,
          reasonCode: raw.reasonCode || 'query_failed',
          unit: 'money',
        }),
        [CUSTOMER_METRIC_CODES.ARR]: unavailableMetric(CUSTOMER_METRIC_CODES.ARR, msg, {
          status: METRIC_STATUS.UNAVAILABLE,
          reasonCode: raw.reasonCode || 'query_failed',
          unit: 'money',
        }),
        [CUSTOMER_METRIC_CODES.BILLED]: unavailableMetric(CUSTOMER_METRIC_CODES.BILLED, msg, {
          status: METRIC_STATUS.UNAVAILABLE,
          reasonCode: raw.reasonCode || 'query_failed',
          unit: 'money',
        }),
        [CUSTOMER_METRIC_CODES.COLLECTED]: unavailableMetric(
          CUSTOMER_METRIC_CODES.COLLECTED,
          msg,
          {
            status: METRIC_STATUS.UNAVAILABLE,
            reasonCode: raw.reasonCode || 'query_failed',
            unit: 'money',
          }
        ),
        [CUSTOMER_METRIC_CODES.OUTSTANDING]: unavailableMetric(
          CUSTOMER_METRIC_CODES.OUTSTANDING,
          msg,
          {
            status: METRIC_STATUS.UNAVAILABLE,
            reasonCode: raw.reasonCode || 'query_failed',
            unit: 'money',
          }
        ),
      },
      subscriptions: [],
      activeSubscription: null,
      hasOutstanding: false,
    };
  }

  const currency = raw.currency;
  const maskOpts = { currency, masked: financeMasked };

  return {
    plan: raw.plan,
    subscriptionStatus: raw.subscriptionStatus,
    currency,
    mrr: raw.mrr,
    arr: raw.arr,
    billed: raw.billed,
    collected: raw.collected,
    outstanding: raw.outstanding,
    renewalDate: raw.renewalDate,
    status: CUSTOMER_READINESS.READY_WITH_LIMITATIONS,
    limitations: COMMERCIAL_LIMITATIONS,
    _envelope: {
      [CUSTOMER_METRIC_CODES.MRR]: moneyEnvelope(CUSTOMER_METRIC_CODES.MRR, raw.mrr, maskOpts),
      [CUSTOMER_METRIC_CODES.ARR]: moneyEnvelope(CUSTOMER_METRIC_CODES.ARR, raw.arr, maskOpts),
      [CUSTOMER_METRIC_CODES.BILLED]: moneyEnvelope(
        CUSTOMER_METRIC_CODES.BILLED,
        raw.billed,
        maskOpts
      ),
      [CUSTOMER_METRIC_CODES.COLLECTED]: moneyEnvelope(
        CUSTOMER_METRIC_CODES.COLLECTED,
        raw.collected,
        maskOpts
      ),
      [CUSTOMER_METRIC_CODES.OUTSTANDING]: moneyEnvelope(
        CUSTOMER_METRIC_CODES.OUTSTANDING,
        raw.outstanding,
        maskOpts
      ),
    },
    subscriptions: raw.subscriptions,
    activeSubscription: raw.activeSubscription,
    hasOutstanding: raw.hasOutstanding,
  };
}
