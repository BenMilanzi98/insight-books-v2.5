# Audit and Observability

## Audit trail

Two complementary stores:

1. **`AcctV2PeriodStatusHistory`** — immutable, append-only record of every
   status transition (previous/new status, action, reason, requestedBy /
   approvedBy / executedBy, requestId, correlationId, metadata). Written by
   `transitionPeriod` inside the same transaction as the change.
2. **`recordAccountingAudit`** (Phase 2 audit trail) — financial-year
   creation/opening, calendar-config changes (previous/new values, reason),
   lock-date changes, close begin/approve/execute, task waivers, exception
   acceptance, reopen request/approve/reject, migration batches, and every
   rejected posting attempt (`acctv2.period.postingRejected` with reason
   code).

Every record carries business, year, period, user, action, reason, request
ID, correlation ID and timestamp.

## Observability

Structured audit rows double as metrics sources: closed-period posting
attempts, backdated requests/approvals, future-dated requests, closes
started/completed/blocked, reopenings requested/completed, close duration
(startedAt→completedAt), outstanding tasks and blocking exceptions are all
queryable per business. `runPeriodMonitoring` exposes the derived health
findings for dashboards and alerting. Logs exclude attachments and private
financial detail.
