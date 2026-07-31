/**
 * Customer Intelligence overview aggregates.
 * Failed queries → UNAVAILABLE envelopes (never coerce to 0).
 */

import {
  activePaidSubscriptionWhere,
} from '@/lib/admin/saasBillingKpis';
import {
  METRIC_STATUS,
  metricEnvelope,
  unavailableMetric,
} from '@/lib/admin/intelligence/metricStates.js';
import { assertNoFalseZero } from '@/lib/admin/intelligence/executiveKpiPack.js';
import { resolveCustomerAccess } from './authz.js';
import {
  CUSTOMER_CATALOGUE_VERSION,
  CUSTOMER_METRIC_CODES,
  CUSTOMER_READINESS,
} from './catalogue.js';
import { listUnassignedTenantIds } from './segments.js';
import { resolvePortfolioScope } from './portfolioScope.js';

function readyCount(code, value, extras = {}) {
  return metricEnvelope({
    code,
    status: extras.status || METRIC_STATUS.READY_WITH_LIMITATIONS,
    value,
    unit: 'count',
    label: extras.label || code,
    source: extras.source || 'Tenant / AccountSubscription',
    limitations: extras.limitations || null,
    freshness: extras.freshness || null,
  });
}

function queryFail(code, message) {
  return unavailableMetric(code, message, {
    status: METRIC_STATUS.UNAVAILABLE,
    reasonCode: 'query_failed',
    unit: 'count',
  });
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, now?: Date, currency?: string }} opts
 */
export async function buildCustomerOverviewPack(prisma, opts = {}) {
  const access = resolveCustomerAccess(opts.admin);
  if (!access.canView) {
    return {
      ok: false,
      forbidden: true,
      catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
      metrics: {},
    };
  }

  const now = opts.now || new Date();
  const freshness = { asOf: now.toISOString(), status: 'LIVE_QUERY' };
  const metrics = {};
  const limitations = [
    'Lifecycle overview counts are rough status/subscription proxies, not full resolveLifecycleStage per tenant.',
    'Adoption / DAU / support are not included (UNAVAILABLE / NOT_INSTRUMENTED).',
  ];

  // Total tenants
  try {
    const total = await prisma.tenant.count();
    metrics[CUSTOMER_METRIC_CODES.TENANTS_TOTAL] = readyCount(
      CUSTOMER_METRIC_CODES.TENANTS_TOTAL,
      total,
      {
        status: METRIC_STATUS.READY,
        label: 'Total customers (tenants)',
        source: 'Tenant',
        freshness,
      }
    );
  } catch (e) {
    metrics[CUSTOMER_METRIC_CODES.TENANTS_TOTAL] = queryFail(
      CUSTOMER_METRIC_CODES.TENANTS_TOTAL,
      e?.message || 'Tenant count failed'
    );
  }

  // Trial subscriptions (active trial rows)
  try {
    const trialCount = await prisma.accountSubscription.count({
      where: {
        isTrial: true,
        trialEndDate: { gt: now },
        status: { notIn: ['Expired', 'expired', 'EXPIRED', 'cancelled', 'Cancelled'] },
      },
    });
    metrics[CUSTOMER_METRIC_CODES.TENANTS_TRIAL] = readyCount(
      CUSTOMER_METRIC_CODES.TENANTS_TRIAL,
      trialCount,
      {
        label: 'Active trial subscriptions',
        source: 'AccountSubscription.isTrial',
        freshness,
        limitations: 'Counts trial subscription rows, not distinct tenants.',
      }
    );
  } catch (e) {
    metrics[CUSTOMER_METRIC_CODES.TENANTS_TRIAL] = queryFail(
      CUSTOMER_METRIC_CODES.TENANTS_TRIAL,
      e?.message || 'Trial count failed'
    );
  }

  // Active paid distinct tenants
  try {
    const paidRows = await prisma.accountSubscription.findMany({
      where: activePaidSubscriptionWhere(now),
      select: { tenantId: true },
    });
    const distinct = new Set((paidRows || []).map((r) => r.tenantId).filter(Boolean));
    metrics[CUSTOMER_METRIC_CODES.TENANTS_ACTIVE_PAID] = readyCount(
      CUSTOMER_METRIC_CODES.TENANTS_ACTIVE_PAID,
      distinct.size,
      {
        label: 'Active paid customers',
        source: 'AccountSubscription (active paid)',
        freshness,
        limitations: 'Distinct tenants with at least one active paid subscription.',
      }
    );
  } catch (e) {
    metrics[CUSTOMER_METRIC_CODES.TENANTS_ACTIVE_PAID] = queryFail(
      CUSTOMER_METRIC_CODES.TENANTS_ACTIVE_PAID,
      e?.message || 'Active paid count failed'
    );
  }

  // Suspended / archived rough from Tenant.status
  try {
    const suspended = await prisma.tenant.count({
      where: {
        status: { in: ['SUSPENDED', 'SUSPENSION_PENDING', 'RESTRICTED', 'suspended'] },
      },
    });
    metrics[CUSTOMER_METRIC_CODES.TENANTS_SUSPENDED] = readyCount(
      CUSTOMER_METRIC_CODES.TENANTS_SUSPENDED,
      suspended,
      {
        label: 'Suspended customers',
        source: 'Tenant.status',
        freshness,
      }
    );
  } catch (e) {
    metrics[CUSTOMER_METRIC_CODES.TENANTS_SUSPENDED] = queryFail(
      CUSTOMER_METRIC_CODES.TENANTS_SUSPENDED,
      e?.message || 'Suspended count failed'
    );
  }

  try {
    const archived = await prisma.tenant.count({
      where: { status: { in: ['ARCHIVED', 'CLOSED', 'archived'] } },
    });
    metrics[CUSTOMER_METRIC_CODES.TENANTS_ARCHIVED] = readyCount(
      CUSTOMER_METRIC_CODES.TENANTS_ARCHIVED,
      archived,
      {
        label: 'Archived customers',
        source: 'Tenant.status',
        freshness,
      }
    );
  } catch (e) {
    metrics[CUSTOMER_METRIC_CODES.TENANTS_ARCHIVED] = queryFail(
      CUSTOMER_METRIC_CODES.TENANTS_ARCHIVED,
      e?.message || 'Archived count failed'
    );
  }

  // Unassigned attention count (managers / Super Admin). Agents with ownership → null/skip.
  try {
    const scope = await resolvePortfolioScope(prisma, opts.admin, { now });
    if (scope.mode === 'owned') {
      metrics[CUSTOMER_METRIC_CODES.TENANTS_UNASSIGNED] = unavailableMetric(
        CUSTOMER_METRIC_CODES.TENANTS_UNASSIGNED,
        'Portfolio-scoped agents do not see unassigned attention count',
        {
          status: METRIC_STATUS.UNAVAILABLE,
          reasonCode: 'portfolio_scoped',
          unit: 'count',
        }
      );
    } else {
      const unassigned = await listUnassignedTenantIds(prisma, { now, take: 2000 });
      if (!unassigned.ok) {
        metrics[CUSTOMER_METRIC_CODES.TENANTS_UNASSIGNED] = queryFail(
          CUSTOMER_METRIC_CODES.TENANTS_UNASSIGNED,
          unassigned.error || 'Unassigned count failed'
        );
      } else {
        metrics[CUSTOMER_METRIC_CODES.TENANTS_UNASSIGNED] = readyCount(
          CUSTOMER_METRIC_CODES.TENANTS_UNASSIGNED,
          unassigned.tenantIds.length,
          {
            label: 'Unassigned customers',
            source: 'Tenant minus ACTIVE CustomerOwnership',
            freshness,
            limitations:
              'Scans up to 2000 recent tenants; not a full table count when larger.',
          }
        );
      }
    }
  } catch (e) {
    metrics[CUSTOMER_METRIC_CODES.TENANTS_UNASSIGNED] = queryFail(
      CUSTOMER_METRIC_CODES.TENANTS_UNASSIGNED,
      e?.message || 'Unassigned count failed'
    );
  }

  for (const m of Object.values(metrics)) {
    if (!assertNoFalseZero(m)) {
      // Defensive: coerce false-zero envelopes to null value
      m.value = null;
    }
  }

  return {
    ok: true,
    forbidden: false,
    catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
    generatedAt: now.toISOString(),
    metrics,
    adoption: {
      status: CUSTOMER_READINESS.UNAVAILABLE,
      reason: 'FEATURE_USED not emitted',
    },
    service: {
      support: { status: CUSTOMER_READINESS.NOT_INSTRUMENTED },
      onboarding: { status: CUSTOMER_READINESS.NOT_INSTRUMENTED },
      training: { status: CUSTOMER_READINESS.NOT_INSTRUMENTED },
    },
    limitations,
    authz: {
      masked: access.financeMasked,
      financeOk: access.financeOk,
    },
  };
}
