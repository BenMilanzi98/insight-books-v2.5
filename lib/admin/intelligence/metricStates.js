/** Executive metric envelope statuses — never coerce failures to zero. */

export const METRIC_STATUS = Object.freeze({
  READY: 'READY',
  READY_WITH_LIMITATIONS: 'READY_WITH_LIMITATIONS',
  READY_WITH_RECONCILIATION: 'READY_WITH_RECONCILIATION',
  UNAVAILABLE: 'UNAVAILABLE',
  STALE: 'STALE',
  RECON_FAILED: 'RECON_FAILED',
  NOT_SUPPORTED: 'NOT_SUPPORTED',
  FORBIDDEN: 'FORBIDDEN',
});

/**
 * @param {object} partial
 */
export function metricEnvelope(partial = {}) {
  const status = partial.status || METRIC_STATUS.UNAVAILABLE;
  const readyLike =
    status === METRIC_STATUS.READY ||
    status === METRIC_STATUS.READY_WITH_LIMITATIONS ||
    status === METRIC_STATUS.READY_WITH_RECONCILIATION;
  // Stale / recon-failed keep the last known value but must surface warnings
  const valueVisible =
    readyLike ||
    status === METRIC_STATUS.STALE ||
    status === METRIC_STATUS.RECON_FAILED;

  return {
    code: partial.code || 'unknown',
    status,
    value: valueVisible ? (partial.value ?? null) : null,
    unit: partial.unit || null,
    currency: partial.currency || null,
    label: partial.label || partial.code || 'Metric',
    definition: partial.definition || null,
    ruleVersion: partial.ruleVersion || 'kpi-2026-07-28',
    source: partial.source || null,
    period: partial.period || null,
    comparison: partial.comparison ?? null,
    freshness: partial.freshness || null,
    reconciliation: partial.reconciliation || null,
    reasonCode: readyLike
      ? partial.reasonCode || null
      : partial.reasonCode || status.toLowerCase(),
    reasonMessage: readyLike
      ? partial.reasonMessage || null
      : partial.reasonMessage || 'Data unavailable',
    limitations: partial.limitations || null,
    masked: Boolean(partial.masked),
  };
}

export function unavailableMetric(code, reasonMessage, extras = {}) {
  return metricEnvelope({
    code,
    status: extras.status || METRIC_STATUS.NOT_SUPPORTED,
    reasonCode: extras.reasonCode || 'not_supported',
    reasonMessage,
    label: extras.label,
    definition: extras.definition,
    source: extras.source,
    ...extras,
  });
}
