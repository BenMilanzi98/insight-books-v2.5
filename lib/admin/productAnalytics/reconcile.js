/**
 * Light product reconciliation — catalogue vs events/facts for commerce trio.
 * Failed recon ≠ false complete metric (surfaces RECONCILIATION_FAILED).
 */

import {
  FEATURE_EVENT_CODES,
  INSTRUMENTED_FEATURE_CODES,
  getProductFeature,
  isInstrumentedFeature,
} from '@/lib/admin/productCatalogue/features.js';
import { resolveProductAnalyticsAccess } from './authz.js';
import {
  PRODUCT_ANALYTICS_CATALOGUE_VERSION,
  PRODUCT_RELIABILITY_STATUS,
} from './catalogue.js';
import { resolvePortfolioScope } from '@/lib/admin/customers/portfolioScope.js';

export const PRODUCT_RECON_VERSION = 'product-recon-2026-07-29';

/**
 * Pure honesty: recon failure must not yield a READY/complete metric envelope.
 * @param {{ reconStatus: string, metricStatus?: string, conversionRate?: number|null, complete?: boolean }} input
 */
export function applyReconHonesty(input = {}) {
  const reconFailed =
    input.reconStatus === PRODUCT_RELIABILITY_STATUS.RECONCILIATION_FAILED ||
    input.reconStatus === 'FAIL' ||
    input.reconOk === false;
  const reconUnavailable =
    input.reconStatus === 'UNAVAILABLE' ||
    input.reconStatus === PRODUCT_RELIABILITY_STATUS.DATA_QUALITY_BLOCKED;

  if (!reconFailed && !reconUnavailable) {
    return {
      metricStatus: input.metricStatus || PRODUCT_RELIABILITY_STATUS.AVAILABLE,
      conversionRate: input.conversionRate,
      complete: Boolean(input.complete),
      blockedByRecon: false,
    };
  }

  return {
    metricStatus: reconFailed
      ? PRODUCT_RELIABILITY_STATUS.RECONCILIATION_FAILED
      : PRODUCT_RELIABILITY_STATUS.DATA_QUALITY_BLOCKED,
    conversionRate: null,
    complete: false,
    blockedByRecon: true,
    reasonCode: reconFailed ? 'reconciliation_failed' : 'reconciliation_unavailable',
    reasonMessage:
      'Failed or unavailable reconciliation blocks complete metrics — never false READY conversion',
  };
}

async function safeCount(fn) {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (e) {
    return { ok: false, value: null, error: e?.message || 'count_failed' };
  }
}

/**
 * Reconcile one instrumented feature: catalogue ↔ events ↔ usage facts.
 */
export async function reconcileFeaturePlane(prisma, featureCode, tenantFilter) {
  const feature = getProductFeature(featureCode);
  if (!feature || !isInstrumentedFeature(featureCode)) {
    return {
      featureCode,
      status: PRODUCT_RELIABILITY_STATUS.NOT_INSTRUMENTED,
      cards: [],
      reconOk: null,
    };
  }

  const eventType = FEATURE_EVENT_CODES[featureCode];
  const cards = [];
  const whereTenant = tenantFilter ? { tenantId: tenantFilter } : {};

  cards.push({
    id: `${featureCode}.catalogue`,
    label: 'Catalogue instrumented',
    value: 1,
    status: 'READY',
    source: 'productCatalogue.features',
    detail: feature.name,
  });

  let eventCount = null;
  let eventStatus = 'UNAVAILABLE';
  if (typeof prisma?.analyticsEvent?.count === 'function' && eventType) {
    const counted = await safeCount(() =>
      prisma.analyticsEvent.count({
        where: { eventType, ...whereTenant },
      })
    );
    if (counted.ok) {
      eventCount = counted.value;
      eventStatus = 'READY';
    } else {
      cards.push({
        id: `${featureCode}.events_error`,
        label: 'Event count error',
        value: null,
        status: 'UNAVAILABLE',
        source: 'AnalyticsEvent',
        detail: counted.error,
      });
    }
  }

  cards.push({
    id: `${featureCode}.events`,
    label: 'AnalyticsEvent count',
    value: eventCount,
    status: eventStatus,
    source: 'AnalyticsEvent',
    detail: eventType,
  });

  let factCount = null;
  let factStatus = 'UNAVAILABLE';
  if (typeof prisma?.analyticsFactProductUsage?.count === 'function') {
    const counted = await safeCount(() =>
      prisma.analyticsFactProductUsage.count({
        where: { featureCode, ...whereTenant },
      })
    );
    if (counted.ok) {
      factCount = counted.value;
      factStatus = 'READY';
    }
  }

  cards.push({
    id: `${featureCode}.facts`,
    label: 'Usage fact count',
    value: factCount,
    status: factStatus,
    source: 'AnalyticsFactProductUsage',
  });

  let firstValueCount = null;
  if (typeof prisma?.productFirstValueFact?.count === 'function') {
    const counted = await safeCount(() =>
      prisma.productFirstValueFact.count({
        where: { featureCode, ...whereTenant },
      })
    );
    if (counted.ok) firstValueCount = counted.value;
  }

  cards.push({
    id: `${featureCode}.first_value`,
    label: 'First-value fact count',
    value: firstValueCount,
    status: firstValueCount == null ? 'UNAVAILABLE' : 'READY',
    source: 'ProductFirstValueFact',
  });

  // Honesty: events without facts (or unreadable planes) → recon fail
  let reconOk = true;
  let reconStatus = 'READY';
  if (eventStatus === 'UNAVAILABLE' || factStatus === 'UNAVAILABLE') {
    reconOk = false;
    reconStatus = 'UNAVAILABLE';
  } else if (eventCount != null && factCount != null && eventCount > 0 && factCount === 0) {
    reconOk = false;
    reconStatus = 'FAIL';
  } else if (
    eventCount != null &&
    factCount != null &&
    factCount > eventCount
  ) {
    // Facts should not exceed events for same feature plane
    reconOk = false;
    reconStatus = 'FAIL';
  }

  const honesty = applyReconHonesty({
    reconStatus: reconOk
      ? PRODUCT_RELIABILITY_STATUS.AVAILABLE
      : reconStatus === 'UNAVAILABLE'
        ? 'UNAVAILABLE'
        : PRODUCT_RELIABILITY_STATUS.RECONCILIATION_FAILED,
    metricStatus: PRODUCT_RELIABILITY_STATUS.AVAILABLE,
    conversionRate: reconOk ? 1 : 0,
    complete: reconOk,
  });

  cards.push({
    id: `${featureCode}.recon`,
    label: 'Feature plane reconciliation',
    value: reconOk ? 1 : 0,
    status: reconStatus,
    source: 'catalogue↔events↔facts',
    detail: honesty.blockedByRecon
      ? honesty.reasonMessage
      : 'Event/fact planes aligned for instrumented feature',
  });

  return {
    featureCode,
    eventType,
    eventCount,
    factCount,
    firstValueCount,
    reconOk,
    reconStatus,
    metricStatus: honesty.metricStatus,
    conversionRate: honesty.conversionRate,
    complete: honesty.complete,
    blockedByRecon: honesty.blockedByRecon,
    cards,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, tenantId?: string, now?: Date }} opts
 */
export async function buildProductReconciliation(prisma, opts = {}) {
  const access = resolveProductAnalyticsAccess(opts.admin);
  if (!access.canView) {
    return {
      ok: false,
      forbidden: true,
      reconVersion: PRODUCT_RECON_VERSION,
    };
  }

  if (!access.canRunReconciliation && opts.requireReconPerm) {
    return {
      ok: false,
      forbidden: true,
      reconVersion: PRODUCT_RECON_VERSION,
      reasonCode: 'recon_permission_required',
    };
  }

  const scope = await resolvePortfolioScope(prisma, opts.admin, { now: opts.now });
  let tenantFilter = null;
  if (opts.tenantId) {
    if (scope.mode === 'owned' && !(scope.tenantIds || []).includes(String(opts.tenantId))) {
      return {
        ok: false,
        forbidden: true,
        reconVersion: PRODUCT_RECON_VERSION,
        reasonCode: 'tenant_out_of_portfolio',
      };
    }
    tenantFilter = { equals: String(opts.tenantId) };
  } else if (scope.mode === 'owned') {
    tenantFilter = { in: scope.tenantIds || [] };
  } else if (scope.mode === 'none') {
    tenantFilter = { in: [] };
  }

  const features = [...INSTRUMENTED_FEATURE_CODES];
  const featureResults = [];
  const cards = [];

  for (const featureCode of features) {
    const result = await reconcileFeaturePlane(prisma, featureCode, tenantFilter);
    featureResults.push(result);
    cards.push(...result.cards);
  }

  const anyFail = featureResults.some((r) => r.reconStatus === 'FAIL');
  const anyUnavailable = featureResults.some((r) => r.reconStatus === 'UNAVAILABLE');
  const overallStatus = anyFail
    ? 'FAIL'
    : anyUnavailable
      ? 'UNAVAILABLE'
      : 'READY';

  // Aggregate honesty: failed recon must not claim complete portfolio metrics
  const honesty = applyReconHonesty({
    reconStatus:
      overallStatus === 'FAIL'
        ? PRODUCT_RELIABILITY_STATUS.RECONCILIATION_FAILED
        : overallStatus,
    complete: overallStatus === 'READY',
    conversionRate: overallStatus === 'READY' ? 1 : 0,
  });

  return {
    ok: true,
    forbidden: false,
    reconVersion: PRODUCT_RECON_VERSION,
    catalogueVersion: PRODUCT_ANALYTICS_CATALOGUE_VERSION,
    generatedAt: (opts.now || new Date()).toISOString(),
    portfolioMode: scope.mode,
    overallStatus,
    metricStatus: honesty.metricStatus,
    complete: honesty.complete,
    conversionRate: honesty.conversionRate,
    blockedByRecon: honesty.blockedByRecon,
    features: featureResults.map((r) => ({
      featureCode: r.featureCode,
      eventCount: r.eventCount,
      factCount: r.factCount,
      firstValueCount: r.firstValueCount,
      reconOk: r.reconOk,
      reconStatus: r.reconStatus,
      metricStatus: r.metricStatus,
      complete: r.complete,
      blockedByRecon: r.blockedByRecon,
    })),
    cards,
    limitations: [
      'Light recon for Invoice / POS / EIS accept only',
      'Failed recon blocks false-complete metrics',
      'Does not invent domain-table proxies as product events',
    ],
  };
}
