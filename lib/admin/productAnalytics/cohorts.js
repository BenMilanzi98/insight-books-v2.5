/**
 * Product cohorts — first-value anchors only where facts exist (Phase 9 Wave 4).
 * No zero-fill for missing periods. Association ≠ causation.
 */

import {
  INSTRUMENTED_FEATURE_CODES,
  isInstrumentedFeature,
} from '@/lib/admin/productCatalogue/features.js';
import { FIRST_VALUE_RULE_VERSION } from './firstValue.js';
import { resolveProductAnalyticsAccess } from './authz.js';
import { PRODUCT_RELIABILITY_STATUS } from './catalogue.js';
import { resolvePortfolioScope } from '@/lib/admin/customers/portfolioScope.js';

export const COHORT_DEFINITION_VERSION = 'product-cohorts-2026-07-29';

export const ASSOCIATION_DISCLAIMER =
  'Association only — not causation. Cohort co-occurrence does not prove causal effect.';

/**
 * Period key YYYY-MM from a Date / ISO string. Returns null if invalid.
 */
export function cohortPeriodKey(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Build cohort rows from first-value facts — only periods with ≥1 anchor.
 * Never invents empty months.
 *
 * @param {Array<{ tenantId: string, featureCode: string, occurredAt?: Date|string, createdAt?: Date|string }>} facts
 * @param {{ featureCode?: string }} [opts]
 */
export function buildFirstValueCohorts(facts, opts = {}) {
  const featureFilter = opts.featureCode ? String(opts.featureCode) : null;
  const buckets = new Map();

  for (const fact of facts || []) {
    if (!fact?.tenantId) continue;
    const featureCode = String(fact.featureCode || '');
    if (featureFilter && featureCode !== featureFilter) continue;
    if (!isInstrumentedFeature(featureCode)) continue;

    const period = cohortPeriodKey(fact.occurredAt || fact.createdAt);
    if (!period) continue;

    const key = `${featureCode}::${period}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        featureCode,
        period,
        tenantIds: new Set(),
        anchorCount: 0,
      });
    }
    const bucket = buckets.get(key);
    bucket.tenantIds.add(String(fact.tenantId));
    bucket.anchorCount += 1;
  }

  const rows = [...buckets.values()]
    .map((b) => ({
      featureCode: b.featureCode,
      period: b.period,
      tenantCount: b.tenantIds.size,
      anchorCount: b.anchorCount,
      associationLabel: ASSOCIATION_DISCLAIMER,
    }))
    .sort((a, b) => {
      if (a.featureCode !== b.featureCode) {
        return a.featureCode.localeCompare(b.featureCode);
      }
      return a.period.localeCompare(b.period);
    });

  return {
    definitionVersion: COHORT_DEFINITION_VERSION,
    rows,
    zeroFilled: false,
    associationLabel: ASSOCIATION_DISCLAIMER,
    notes: [
      'Only periods with at least one first-value fact appear',
      'Missing months are omitted — never zero-filled',
      ASSOCIATION_DISCLAIMER,
    ],
  };
}

/**
 * Optional association helper — always labelled association, never causation.
 * @param {number} coOccur
 * @param {number} base
 */
export function associationRate(coOccur, base) {
  if (base == null || base <= 0 || coOccur == null) {
    return {
      rate: null,
      label: ASSOCIATION_DISCLAIMER,
      kind: 'association',
      causation: false,
    };
  }
  return {
    rate: coOccur / base,
    label: ASSOCIATION_DISCLAIMER,
    kind: 'association',
    causation: false,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, featureCode?: string, now?: Date }} opts
 */
export async function buildProductCohortsPack(prisma, opts = {}) {
  const access = resolveProductAnalyticsAccess(opts.admin);
  if (!access.canView) {
    return { forbidden: true, definitionVersion: COHORT_DEFINITION_VERSION };
  }

  const featureCode = opts.featureCode ? String(opts.featureCode) : null;
  if (featureCode && !isInstrumentedFeature(featureCode)) {
    return {
      forbidden: false,
      definitionVersion: COHORT_DEFINITION_VERSION,
      status: PRODUCT_RELIABILITY_STATUS.NOT_INSTRUMENTED,
      reasonCode: 'not_instrumented',
      rows: [],
      zeroFilled: false,
      associationLabel: ASSOCIATION_DISCLAIMER,
      limitations: ['Cohorts require instrumented first-value anchors'],
    };
  }

  if (!prisma?.productFirstValueFact?.findMany) {
    return {
      forbidden: false,
      definitionVersion: COHORT_DEFINITION_VERSION,
      status: PRODUCT_RELIABILITY_STATUS.NOT_INSTRUMENTED,
      reasonCode: 'first_value_model_unavailable',
      rows: [],
      zeroFilled: false,
      associationLabel: ASSOCIATION_DISCLAIMER,
      limitations: ['ProductFirstValueFact unavailable — no invented cohorts'],
    };
  }

  const scope = await resolvePortfolioScope(prisma, opts.admin, { now: opts.now });
  const where = {
    ruleVersion: FIRST_VALUE_RULE_VERSION,
    featureCode: featureCode
      ? featureCode
      : { in: [...INSTRUMENTED_FEATURE_CODES] },
  };
  // Portfolio: restrict tenantId when agent-scoped
  if (scope.mode === 'owned') {
    where.tenantId = { in: scope.tenantIds || [] };
  } else if (scope.mode === 'none') {
    where.tenantId = { in: [] };
  }

  let facts = [];
  try {
    facts = await prisma.productFirstValueFact.findMany({
      where,
      select: {
        tenantId: true,
        featureCode: true,
        occurredAt: true,
        createdAt: true,
      },
      take: 5000,
    });
  } catch {
    return {
      forbidden: false,
      definitionVersion: COHORT_DEFINITION_VERSION,
      status: PRODUCT_RELIABILITY_STATUS.DATA_QUALITY_BLOCKED,
      reasonCode: 'query_failed',
      rows: [],
      zeroFilled: false,
      associationLabel: ASSOCIATION_DISCLAIMER,
      limitations: ['First-value query failed — UNAVAILABLE, not zero-filled'],
    };
  }

  const matrix = buildFirstValueCohorts(facts, { featureCode });

  return {
    forbidden: false,
    definitionVersion: COHORT_DEFINITION_VERSION,
    status:
      matrix.rows.length > 0
        ? PRODUCT_RELIABILITY_STATUS.AVAILABLE
        : PRODUCT_RELIABILITY_STATUS.LOW_SAMPLE,
    generatedAt: (opts.now || new Date()).toISOString(),
    portfolioMode: scope.mode,
    ...matrix,
    limitations: [
      'Cohorts only when first-value facts exist',
      'No zero-fill for missing periods',
      ASSOCIATION_DISCLAIMER,
    ],
  };
}
