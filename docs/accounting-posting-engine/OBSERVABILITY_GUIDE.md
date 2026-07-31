# Observability Guide

Implementation: `lib/accountingV2/observability/accountingLogger.js`
(structured logs + in-process metrics), `AcctV2PostingAttempt` (durable
per-attempt records), diagnostics API/UI.

## Structured logging

Every posting attempt emits one structured log line containing: business ID,
event ID, source module/type/ID, event type, template ID + version,
architecture version, posting mode, attempt number, request ID, correlation
ID, duration (ms), status, journal ID, error code and retryable flag.
Sensitive banking/personal data is never logged; failure messages are
sanitized.

## Metrics

`getAccountingMetrics()` exposes counters (since process start):

events received / posted / shadow-posted, posting failures, duplicate attempts
prevented, idempotency conflicts, missing mappings, closed-period failures,
invalid accounts, unbalanced journal attempts, cross-tenant attempts blocked,
average posting duration, rollback count, retry count, legacy–new conflicts,
shadow exact-match and difference counts.

Durable equivalents come from the database: event registry status counts,
attempt outcomes and shadow-comparison classifications are aggregated by the
diagnostics endpoint, so process restarts do not lose the audit-grade numbers.

## Where to look

| Question | Source |
| --- | --- |
| Is the engine healthy for a business? | `/system/accounting-posting-engine` page or `GET /api/accounting-v2/posting-engine` |
| What happened to a specific source? | `GET /api/accounting-v2/events?sourceType=…&sourceId=…` (attempts + shadow detail included) |
| Why did a posting fail? | Event registry `failureCode`/`failureMessage` + the matching `AcctV2PostingAttempt` + audit record, correlated by request ID |
| Shadow accuracy trend | Comparison status counts + exact-match rate on the diagnostics endpoint |

All records for one request share `requestId`; a business workflow spanning
multiple requests shares `correlationId`.
