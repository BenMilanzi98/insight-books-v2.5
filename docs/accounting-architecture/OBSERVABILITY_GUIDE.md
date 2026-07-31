# Observability Guide

Implementation: `lib/accountingV2/observability/accountingLogger.js`.

## Structured logs

Every accounting operation emits one JSON line (`scope: "accountingV2"`) with:
`operation, requestId, correlationId, businessId, sourceModule, sourceType, sourceId,
eventType, postingMode, architectureVersion, status, durationMs, journalId?, errorCode?`.
Errors log separately with code, safe message, retryability, and internal diagnostics.

Never logged: bank-account/card details, secrets, passwords, attachments, personal data —
the logger whitelists the fields above rather than serializing inputs.

Search examples:

```bash
# all V2 accounting operations for a correlation id
grep '"scope":"accountingV2"' app.log | grep '<correlationId>'
# duplicate prevention hits
grep '"code":"DUPLICATE_ACCOUNTING_EVENT"' app.log
```

## Metrics (in-process counters, surfaced on the admin page)

`eventsReceived, duplicatesPrevented, idempotencyConflicts, postingAttempts,
postingFailures, transactionRollbacks, shadowComparisons, shadowExactMatches,
shadowDifferences, crossTenantBlocked, missingMappings, closedPeriodAttempts,
legacyAdapterFailures` via `getAccountingMetrics()` / `incrementMetric()`. Durable
equivalents can be derived from the tables at any time:

| Metric | Durable query |
|---|---|
| Posting attempts / failures | `AcctV2PostingAttempt` by `status` |
| Duplicate events prevented | registry P2002 audit entries + `duplicatesPrevented` |
| Shadow match rate | `AcctV2ShadowComparison` grouped by `status` |
| Average posting duration | `avg(durationMs)` on attempts |
| Outbox health | `AcctV2Outbox` pending count/age (ARCH-005 alert) |

## Integrity monitoring

`npm run audit:forensic -- --module architecture` runs ARCH-001…008 (missing identity ids,
stuck attempts, critical shadow differences, unsupported NEW_ENGINE config, outbox backlog,
missing architecture version, comparison-less shadow journals, cross-tenant shadow refs).
Recommended cadence: daily in staging, and always before/after changing any tenant's posting
mode. The admin page (`/system/accounting-architecture`) shows event counts, comparison
health, flags, and process metrics at a glance.
