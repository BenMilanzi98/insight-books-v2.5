/**
 * Accounting V2 — structured logging and in-process metrics.
 *
 * Every accounting operation logs one structured line with correlation identifiers.
 * Sensitive values (secrets, personal data, full account numbers) are never logged;
 * the payload is limited to the identifiers below.
 */

const metrics = {
  eventsReceived: 0,
  duplicatesPrevented: 0,
  idempotencyConflicts: 0,
  postingAttempts: 0,
  postingFailures: 0,
  transactionRollbacks: 0,
  shadowComparisons: 0,
  shadowExactMatches: 0,
  shadowDifferences: 0,
  crossTenantBlocked: 0,
  missingMappings: 0,
  closedPeriodAttempts: 0,
  legacyAdapterFailures: 0,
};

/** @returns {Readonly<typeof metrics>} snapshot for the admin interface */
export function getAccountingMetrics() {
  return { ...metrics };
}

/** @param {keyof typeof metrics} name */
export function incrementMetric(name, by = 1) {
  if (name in metrics) metrics[name] += by;
}

/** Reset (test support only). */
export function resetAccountingMetrics() {
  for (const key of Object.keys(metrics)) metrics[key] = 0;
}

/**
 * @param {object} entry
 * @param {string} entry.operation
 * @param {import('../domain/accountingContext.js').AccountingContext} entry.context
 * @param {import('../domain/sourceReference.js').SourceReference} [entry.sourceReference]
 * @param {string} [entry.postingMode]
 * @param {string} [entry.status]
 * @param {number} [entry.durationMs]
 * @param {string|null} [entry.journalId]
 * @param {string} [entry.errorCode]
 */
export function logAccountingOperation(entry) {
  metrics.eventsReceived += entry.operation === 'postAccountingEvent' ? 1 : 0;
  metrics.postingAttempts += entry.operation === 'postAccountingEvent' ? 1 : 0;
  if (entry.status === 'FAILED') metrics.postingFailures += 1;
  if (entry.status === 'SHADOWED') metrics.shadowComparisons += 1;

  const line = {
    scope: 'accountingV2',
    ts: new Date().toISOString(),
    operation: entry.operation,
    requestId: entry.context?.requestId,
    correlationId: entry.context?.correlationId,
    businessId: entry.context?.businessId,
    sourceModule: entry.sourceReference?.sourceModule,
    sourceType: entry.sourceReference?.sourceType,
    sourceId: entry.sourceReference?.sourceId,
    eventType: entry.sourceReference?.eventType,
    postingMode: entry.postingMode,
    architectureVersion: 'TRANSITION_V2',
    status: entry.status,
    durationMs: entry.durationMs,
    journalId: entry.journalId ?? undefined,
    errorCode: entry.errorCode ?? undefined,
  };
  // Structured single-line JSON — greppable and ingestible by any log shipper.
  console.log(JSON.stringify(line));
}

/**
 * Log a typed accounting error without leaking diagnostics to the client path.
 * @param {import('../domain/errors.js').AccountingV2Error} err
 * @param {object} [extra]
 */
export function logAccountingError(err, extra = {}) {
  if (err?.code === 'DUPLICATE_ACCOUNTING_EVENT') metrics.duplicatesPrevented += 1;
  if (err?.code === 'CONFLICTING_IDEMPOTENCY_KEY') metrics.idempotencyConflicts += 1;
  if (err?.code === 'CROSS_TENANT_ACCOUNTING') metrics.crossTenantBlocked += 1;
  if (err?.code === 'MISSING_ACCOUNT_MAPPING') metrics.missingMappings += 1;
  if (err?.code === 'CLOSED_ACCOUNTING_PERIOD') metrics.closedPeriodAttempts += 1;
  if (err?.code === 'LEGACY_ARCHITECTURE_ERROR') metrics.legacyAdapterFailures += 1;

  console.error(
    JSON.stringify({
      scope: 'accountingV2',
      ts: new Date().toISOString(),
      level: 'error',
      code: err?.code ?? 'UNKNOWN',
      message: err?.userMessage ?? err?.message,
      requestId: err?.requestId,
      correlationId: err?.correlationId,
      retryable: err?.retryable ?? false,
      diagnostic: err?.diagnostic,
      ...extra,
    })
  );
}
