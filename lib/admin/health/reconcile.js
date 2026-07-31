/**
 * Light health reconciliation — weight sums, band coverage, snapshot vs live.
 */

import { DIMENSION_STATUS, HEALTH_DEFINITION_VERSION } from './catalogue.js';
import {
  resolveHealthAccess,
  resolveHealthPortfolioScope,
  healthTenantIdFilter,
} from './authz.js';
import { getActiveHealthDefinition } from './definitions.js';
import { applyMissingPolicy, evaluateCustomerHealth } from './evaluate.js';
import { applyPortfolioTenantWhere } from '@/lib/admin/customers/portfolioScope.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, tenantId?: string, now?: Date }} opts
 */
export async function buildHealthReconciliation(prisma, opts = {}) {
  const access = resolveHealthAccess(opts.admin);
  if (!access.canView) {
    return {
      ok: false,
      forbidden: true,
      definitionVersion: HEALTH_DEFINITION_VERSION,
    };
  }

  const now = opts.now || new Date();
  const definition = await getActiveHealthDefinition(prisma);
  const scope = await resolveHealthPortfolioScope(prisma, opts.admin, { now });
  const cards = [];
  const limitations = [
    'Light health reconciliation — weight renormalise checks + snapshot inventory.',
    'Does not claim churn probability or Tenant Sale alignment.',
    'Portfolio scope applied where tenant inventory is counted.',
  ];

  // Synthetic renormalise check (commercial+engagement+relationship; mraEis N/A)
  const sampleDims = [
    { code: 'commercial', status: DIMENSION_STATUS.SCORED, baseWeight: 0.35, score: 80 },
    { code: 'engagement', status: DIMENSION_STATUS.SCORED, baseWeight: 0.25, score: 80 },
    { code: 'mraEis', status: DIMENSION_STATUS.NOT_APPLICABLE, baseWeight: 0.2, score: null },
    { code: 'relationship', status: DIMENSION_STATUS.SCORED, baseWeight: 0.2, score: 80 },
  ];
  const { dimensions: renorm, weightSum } = applyMissingPolicy(
    sampleDims,
    definition.missingPolicy
  );
  const weightOk = Math.abs(weightSum - 1) < 1e-6;
  cards.push({
    id: 'renormalised_weight_sum',
    label: 'Renormalised weight sum (N/A mraEis sample)',
    value: weightSum,
    status: weightOk ? 'READY' : 'FAIL',
    expected: 1,
    source: 'EXCLUDE_AND_RENORMALISE',
    detail: renorm
      .filter((d) => d.status === DIMENSION_STATUS.SCORED)
      .map((d) => `${d.code}=${d.effectiveWeight}`)
      .join(', '),
  });

  let snapshotCount = null;
  let snapshotStatus = 'UNAVAILABLE';
  try {
    if (typeof prisma?.customerHealthSnapshot?.count === 'function') {
      const where = {};
      const tenantFilter = healthTenantIdFilter(scope);
      if (tenantFilter) where.tenantId = tenantFilter;
      snapshotCount = await prisma.customerHealthSnapshot.count({ where });
      snapshotStatus = 'READY';
    } else {
      limitations.push('CustomerHealthSnapshot model unavailable');
    }
  } catch (e) {
    limitations.push(`Snapshot count UNAVAILABLE: ${e?.message || 'query failed'}`);
  }

  cards.push({
    id: 'snapshot_count',
    label: 'Health snapshots in scope',
    value: snapshotCount,
    status: snapshotStatus,
    source: 'CustomerHealthSnapshot',
  });

  let tenantCount = null;
  try {
    // Map health scope onto Tenant where (id, not tenantId)
    const tenantScope =
      scope.mode === 'all'
        ? { mode: 'all', tenantIds: null }
        : { mode: 'owned', tenantIds: scope.tenantIds || [] };
    const tenantWhere = applyPortfolioTenantWhere({}, tenantScope);
    if (typeof prisma?.tenant?.count === 'function' && scope.canView) {
      tenantCount = await prisma.tenant.count({ where: tenantWhere });
    }
  } catch {
    tenantCount = null;
  }

  cards.push({
    id: 'tenant_count',
    label: 'Tenants in portfolio scope',
    value: tenantCount,
    status: tenantCount == null ? 'UNAVAILABLE' : 'READY',
    source: 'Tenant',
  });

  let liveCompare = null;
  if (opts.tenantId) {
    const live = await evaluateCustomerHealth(prisma, {
      admin: opts.admin,
      tenantId: opts.tenantId,
      now,
    });
    if (live.ok) {
      liveCompare = {
        tenantId: opts.tenantId,
        score: live.score,
        band: live.band,
        confidence: live.confidence,
        weightSum: live.weightSum,
      };
      cards.push({
        id: 'live_evaluate',
        label: 'Live evaluate (requested tenant)',
        value: live.score,
        status: 'READY',
        band: live.band,
        source: 'evaluateCustomerHealth',
      });
    } else if (live.forbidden) {
      cards.push({
        id: 'live_evaluate',
        label: 'Live evaluate (requested tenant)',
        value: null,
        status: 'FORBIDDEN',
        source: 'evaluateCustomerHealth',
      });
    }
  }

  return {
    ok: true,
    definitionVersion: definition.version,
    missingPolicy: definition.missingPolicy,
    cards,
    liveCompare,
    limitations,
    asOf: now.toISOString(),
  };
}
