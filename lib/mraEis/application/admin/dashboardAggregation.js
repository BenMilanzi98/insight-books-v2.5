/**
 * Phase 18 — Server-side dashboard aggregation (Tenant-scoped).
 * Never treat a failed query as zero. Read models are not financial source of truth.
 */

import { FRESHNESS } from './statusDesignSystem.js';
import { AdminErrors } from './adminErrors.js';

/**
 * Aggregate tenant/business EIS overview from provided authoritative counts.
 * Callers supply DB counts; this layer enforces freshness + failed≠zero rules.
 */
export function aggregateTenantEisOverview({
  context,
  counts = {},
  loadErrors = {},
  projectionUpdatedAt = null,
  sourceUpdatedAt = null,
} = {}) {
  if (!context?.tenantId) throw AdminErrors.context();

  const failedKeys = Object.keys(loadErrors || {});
  const freshness = resolveFreshness({ projectionUpdatedAt, sourceUpdatedAt, failedKeys });

  const card = (key, label, sourceEntity) => {
    if (loadErrors[key]) {
      return {
        key,
        label,
        value: null,
        error: true,
        errorCode: loadErrors[key],
        sourceEntity,
        note: 'Query failed — not displayed as zero.',
      };
    }
    const value = counts[key];
    return {
      key,
      label,
      value: value == null ? 0 : value,
      error: false,
      sourceEntity,
      traceable: true,
    };
  };

  const cards = [
    card('entitlementActive', 'Entitlement active', 'MraEisTenantEntitlement'),
    card('participationActive', 'Participation active', 'MraEisTenantParticipation'),
    card('terminalCount', 'Terminals', 'MraEisTerminal'),
    card('blockedTerminals', 'Blocked terminals', 'MraEisRestriction'),
    card('activeAgents', 'Active agents', 'MraEisTrustedAgent'),
    card('pendingTransmissions', 'Pending transmissions', 'MraEisTransmission'),
    card('acceptedTransmissions', 'Accepted transmissions', 'MraEisTransmission'),
    card('rejectedTransmissions', 'Rejected transmissions', 'MraEisTransmission'),
    card('unknownOutcomes', 'Unknown outcomes', 'MraEisTransmissionReconciliation'),
    card('reconciliationBacklog', 'Reconciliation backlog', 'MraEisTransmissionReconciliation'),
    card('offlineQueueDepth', 'Offline queue depth', 'MraEisOfflineQueueEntry'),
    card('receiptBacklog', 'Receipt backlog', 'MraEisFiscalReceipt'),
    card('activeRestrictions', 'Active restrictions', 'MraEisRestriction'),
    card('pendingUnblockRequests', 'Pending unblock requests', 'MraEisUnblockRequest'),
    card('manualReviewBacklog', 'Manual review backlog', 'MraEisManualReviewCase'),
    card('openIncidents', 'Open incidents', 'MraEisAlertState'),
    card('criticalAlerts', 'Critical alerts', 'MraEisAlertState'),
  ];

  const partial = freshness === FRESHNESS.PARTIAL || failedKeys.length > 0;

  return {
    scope: {
      tenantId: context.tenantId,
      businessId: context.businessId,
      environment: context.environment,
    },
    cards,
    charts: {
      // Chart series must be supplied by caller; empty ≠ failed
      transmissionOutcomes: counts.transmissionOutcomesSeries || null,
      transmissionOutcomesError: Boolean(loadErrors.transmissionOutcomesSeries),
    },
    freshness,
    projectionUpdatedAt,
    sourceUpdatedAt,
    partial,
    financialSourceOfTruth: false,
    readModelVersion: 'tenant-eis-overview-v1',
    evaluatedAt: new Date().toISOString(),
    reconcilesToDetailLists: true,
  };
}

export function aggregatePlatformEisOverview({
  context,
  counts = {},
  loadErrors = {},
  projectionUpdatedAt = null,
} = {}) {
  if (!context?.isPlatformAdmin) {
    throw AdminErrors.authorization({ message: 'Platform dashboard requires system administrator.' });
  }
  const failedKeys = Object.keys(loadErrors || {});
  const freshness = resolveFreshness({ projectionUpdatedAt, failedKeys });

  const safe = (key, label) =>
    loadErrors[key]
      ? { key, label, value: null, error: true, note: 'Failed — not zero' }
      : { key, label, value: counts[key] ?? 0, error: false, traceable: true };

  return {
    scope: { environment: context.environment, platform: true },
    cards: [
      safe('entitledTenants', 'EIS-entitled tenants'),
      safe('productionBusinesses', 'Production-enabled businesses'),
      safe('sandboxBusinesses', 'Sandbox-enabled businesses'),
      safe('activeTerminals', 'Active terminals'),
      safe('blockedTerminals', 'Blocked terminals'),
      safe('activeAgents', 'Active agents'),
      safe('pendingTransmissions', 'Pending transmissions'),
      safe('unknownOutcomes', 'Unknown outcomes'),
      safe('activeRestrictions', 'Active restrictions'),
      safe('certificationExpirations', 'Certification expirations'),
      safe('openIncidents', 'Open incidents'),
      safe('manualReviewBacklog', 'Manual review backlog'),
    ],
    freshness,
    partial: failedKeys.length > 0,
    financialSourceOfTruth: false,
    crossTenantDrillDownRequiresPermission: true,
    readModelVersion: 'platform-eis-overview-v1',
    evaluatedAt: new Date().toISOString(),
  };
}

function resolveFreshness({ projectionUpdatedAt, sourceUpdatedAt, failedKeys }) {
  if (failedKeys?.length) return FRESHNESS.PARTIAL;
  if (!projectionUpdatedAt && !sourceUpdatedAt) return FRESHNESS.CURRENT;
  const ts = new Date(projectionUpdatedAt || sourceUpdatedAt).getTime();
  if (Number.isNaN(ts)) return FRESHNESS.UNAVAILABLE;
  const ageMs = Date.now() - ts;
  if (ageMs < 30_000) return FRESHNESS.LIVE;
  if (ageMs < 5 * 60_000) return FRESHNESS.CURRENT;
  if (ageMs < 30 * 60_000) return FRESHNESS.SLIGHTLY_DELAYED;
  return FRESHNESS.STALE;
}

/**
 * Build scoped cache key — never unscoped global.
 */
export function buildDashboardCacheKey({
  tenantId,
  businessId = null,
  environment,
  roleScope,
  dateRange = null,
  filterHash = 'none',
  readModelVersion,
} = {}) {
  if (!tenantId && roleScope !== 'PLATFORM') {
    throw AdminErrors.context({ message: 'Cache key requires Tenant scope.' });
  }
  return [
    'eis-dash',
    roleScope || 'TENANT',
    tenantId || 'platform',
    businessId || '-',
    environment || 'SANDBOX',
    dateRange || '-',
    filterHash,
    readModelVersion || 'v1',
  ].join(':');
}
