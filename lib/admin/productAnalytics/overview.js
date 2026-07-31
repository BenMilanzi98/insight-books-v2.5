/**
 * Product Analytics overview pack — commerce metrics + catalogue honesty (Phase 9 Wave 3).
 * Never invent numeric zeros for NOT_INSTRUMENTED / UNAVAILABLE.
 */

import {
  listProductModules,
  listProductFeatures,
  PRODUCT_CATALOGUE_VERSION,
} from '@/lib/admin/productCatalogue';
import {
  METRIC_STATUS,
  metricEnvelope,
} from '@/lib/admin/intelligence/metricStates.js';
import { resolvePortfolioScope } from '@/lib/admin/customers/portfolioScope.js';
import {
  PRODUCT_ANALYTICS_CATALOGUE_VERSION,
  PRODUCT_ANALYTICS_NOTES,
  PRODUCT_METRIC_CODES,
  PRODUCT_RELIABILITY_STATUS,
} from './catalogue.js';
import { evaluateProductReliability } from './reliabilityGate.js';
import { resolveProductAnalyticsAccess } from './authz.js';

const COMMERCE_METRICS = [
  {
    code: PRODUCT_METRIC_CODES.INVOICES_POST_COUNT,
    featureCode: 'invoices.post',
    label: 'Invoices posted',
    definition: 'Count of product usage facts for posted sales invoices',
  },
  {
    code: PRODUCT_METRIC_CODES.POS_COMPLETE_COUNT,
    featureCode: 'sales.pos.complete',
    label: 'POS sales completed',
    definition: 'Count of product usage facts for completed POS sales',
  },
  {
    code: PRODUCT_METRIC_CODES.EIS_ACCEPT_COUNT,
    featureCode: 'eis.fiscal.accept',
    label: 'MRA EIS accepted',
    definition: 'Count of product usage facts for accepted fiscal transmissions',
  },
];

function mapReliabilityToMetricStatus(status) {
  if (status === PRODUCT_RELIABILITY_STATUS.AVAILABLE) return METRIC_STATUS.READY;
  if (status === PRODUCT_RELIABILITY_STATUS.STALE) return METRIC_STATUS.STALE;
  if (status === PRODUCT_RELIABILITY_STATUS.RECONCILIATION_FAILED) {
    return METRIC_STATUS.RECON_FAILED;
  }
  if (status === PRODUCT_RELIABILITY_STATUS.PERMISSION_RESTRICTED) {
    return METRIC_STATUS.FORBIDDEN;
  }
  if (status === PRODUCT_RELIABILITY_STATUS.NOT_INSTRUMENTED) {
    return 'NOT_INSTRUMENTED';
  }
  return METRIC_STATUS.UNAVAILABLE;
}

async function countUsageFacts(db, featureCode, tenantFilter = null) {
  if (!db?.analyticsFactProductUsage?.count) {
    return { ok: false, reasonCode: 'fact_model_unavailable' };
  }
  try {
    const where = { featureCode };
    if (tenantFilter) where.tenantId = tenantFilter;
    const value = await db.analyticsFactProductUsage.count({ where });
    return { ok: true, value };
  } catch {
    return { ok: false, reasonCode: 'query_failed' };
  }
}

function portfolioTenantFilter(scope) {
  if (!scope || scope.mode === 'all') return null;
  if (scope.mode === 'owned') return { in: scope.tenantIds || [] };
  if (scope.mode === 'none') return { in: [] };
  return null;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, now?: Date }} opts
 */
export async function buildProductAnalyticsOverviewPack(prisma, opts = {}) {
  const access = resolveProductAnalyticsAccess(opts.admin);
  if (!access.canView) {
    return { forbidden: true };
  }

  const now = opts.now || new Date();
  const scope = await resolvePortfolioScope(prisma, opts.admin, { now });
  const tenantFilter = portfolioTenantFilter(scope);
  const metrics = {};
  const limitations = [...PRODUCT_ANALYTICS_NOTES];
  if (scope.mode === 'owned' || scope.mode === 'none') {
    limitations.push('Overview counts restricted to owned portfolio tenants');
  }

  for (const def of COMMERCE_METRICS) {
    const gate = evaluateProductReliability(def.code, {
      featureCode: def.featureCode,
      permissionOk: true,
      definitionActive: true,
    });

    if (gate.status !== PRODUCT_RELIABILITY_STATUS.AVAILABLE) {
      metrics[def.code] = metricEnvelope({
        code: def.code,
        status: mapReliabilityToMetricStatus(gate.status),
        value: null,
        label: def.label,
        definition: def.definition,
        source: 'product_usage_facts',
        reasonCode: gate.reasonCode,
        reasonMessage: gate.reasonMessage,
        ruleVersion: PRODUCT_ANALYTICS_CATALOGUE_VERSION,
        freshness: { asOf: now.toISOString() },
      });
      continue;
    }

    const counted = await countUsageFacts(prisma, def.featureCode, tenantFilter);
    if (!counted.ok) {
      metrics[def.code] = metricEnvelope({
        code: def.code,
        status: METRIC_STATUS.UNAVAILABLE,
        value: null,
        label: def.label,
        definition: def.definition,
        source: 'product_usage_facts',
        reasonCode: counted.reasonCode,
        reasonMessage:
          'Usage facts could not be read — showing UNAVAILABLE, not a false zero',
        ruleVersion: PRODUCT_ANALYTICS_CATALOGUE_VERSION,
        freshness: { asOf: now.toISOString() },
      });
      continue;
    }

    metrics[def.code] = metricEnvelope({
      code: def.code,
      status: METRIC_STATUS.READY_WITH_LIMITATIONS,
      value: counted.value,
      unit: 'count',
      label: def.label,
      definition: def.definition,
      source: 'product_usage_facts',
      limitations: 'Counts only server-verified commerce usage facts',
      ruleVersion: PRODUCT_ANALYTICS_CATALOGUE_VERSION,
      freshness: { asOf: now.toISOString() },
    });
  }

  const modules = listProductModules().map((m) => ({
    code: m.code,
    name: m.name,
    area: m.area,
    instrumentation: m.instrumentation,
    lifecycle: m.lifecycle,
    cadence: m.cadence,
    status:
      m.instrumentation === 'INSTRUMENTED'
        ? PRODUCT_RELIABILITY_STATUS.AVAILABLE
        : PRODUCT_RELIABILITY_STATUS.NOT_INSTRUMENTED,
  }));

  const features = listProductFeatures().map((f) => {
    const gate = evaluateProductReliability(`product.feature.${f.code}.count`, {
      featureCode: f.code,
    });
    return {
      code: f.code,
      name: f.name,
      moduleCode: f.moduleCode,
      instrumented: f.instrumented,
      instrumentation: f.instrumentation,
      eventCode: f.eventCode,
      meaningfulAction: f.meaningfulAction,
      status: gate.status,
      reasonCode: gate.reasonCode,
      reasonMessage: gate.reasonMessage,
      value: null,
    };
  });

  const uninstrumentedModules = modules.filter(
    (m) => m.status === PRODUCT_RELIABILITY_STATUS.NOT_INSTRUMENTED
  ).length;
  const uninstrumentedFeatures = features.filter(
    (f) => f.status === PRODUCT_RELIABILITY_STATUS.NOT_INSTRUMENTED
  ).length;

  if (uninstrumentedModules > 0 || uninstrumentedFeatures > 0) {
    limitations.push(
      `${uninstrumentedModules} modules and ${uninstrumentedFeatures} catalogue features are NOT_INSTRUMENTED — never shown as 0`
    );
  }

  return {
    forbidden: false,
    catalogueVersion: PRODUCT_CATALOGUE_VERSION,
    analyticsCatalogueVersion: PRODUCT_ANALYTICS_CATALOGUE_VERSION,
    generatedAt: now.toISOString(),
    portfolioMode: scope.mode,
    metrics,
    modules,
    features,
    limitations,
    naLabel: 'N/A',
  };
}
