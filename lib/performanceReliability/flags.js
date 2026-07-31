/**
 * Phase 17 performance feature flags (server-controlled names).
 * Wired into accountingV2 featureFlags KNOWN_FLAGS / defaults.
 */

export const PERFORMANCE_FLAGS = Object.freeze({
  ENABLED: 'performanceReliabilityV2Enabled',
  OBSERVABILITY: 'observabilityV2Enabled',
  TENANT_QUOTA: 'tenantQuotaV2Enabled',
  BACKPRESSURE: 'backpressureV2Enabled',
  CIRCUIT_BREAKER: 'circuitBreakerV2Enabled',
  REPORT_CACHING: 'reportCachingV2Enabled',
  BACKGROUND_EXPORT: 'backgroundExportV2Enabled',
  BACKGROUND_IMPORT: 'backgroundImportV2Enabled',
  ALERTING: 'performanceAlertingV2Enabled',
  READ_REPLICA: 'readReplicaV2Enabled',
});

/** Process-local override for tests; production uses DB feature-flag rows. */
const localOverrides = new Map();

export function setPerformanceFlagOverride(flag, enabled) {
  localOverrides.set(flag, Boolean(enabled));
}

export function clearPerformanceFlagOverrides() {
  localOverrides.clear();
}

/**
 * Default-on for core observability/fairness; opt-in for riskier paths.
 */
export function isPerformanceFlagEnabled(flag, { dbEnabled } = {}) {
  if (localOverrides.has(flag)) return localOverrides.get(flag);
  if (typeof dbEnabled === 'boolean') return dbEnabled;
  const defaultOn = new Set([
    PERFORMANCE_FLAGS.ENABLED,
    PERFORMANCE_FLAGS.OBSERVABILITY,
    PERFORMANCE_FLAGS.TENANT_QUOTA,
    PERFORMANCE_FLAGS.BACKPRESSURE,
    PERFORMANCE_FLAGS.ALERTING,
  ]);
  return defaultOn.has(flag);
}
