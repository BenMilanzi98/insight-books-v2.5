# Period Reopening

`lib/accountingV2/periods/periodReopenService.js`.

## Workflow

1. `requestReopen(periodId, {reason, expectedCorrections})` — reason is
   mandatory; the period must be CLOSED; the impact analysis is computed and
   stored on the request (`AcctV2PeriodReopenRequest`, status
   `PENDING_APPROVAL`); a `REQUEST_REOPEN` history row is written.
2. Approvers review the request + impact in the UI (period detail panel).
3. `approveReopen(requestId, {correctionScope})` — **must be a different
   user** than the requester (separation of duties); sets the period to
   `REOPENED` via `transitionPeriod`, marks the completed close run
   `SUPERSEDED` (preserved), stamps a re-close deadline
   (`recloseDeadlineDays` from config), publishes the
   `acctv2.period.reopened` outbox event and audits everything.
4. `rejectReopen(requestId, {rejectionReason})` — preserves the request with
   status `REJECTED` and the reason; the period stays CLOSED.

## Reopened-period restrictions

A REOPENED period is **not** an ordinary open period: `resolvePeriodV2`
requires adjustment authorization (`accountingPeriods.postAdjustments`) for
any posting into it, the approved correction scope is stored on the request,
comments/reasons are mandatory, and the monitoring job flags overdue
re-closes past the deadline. Unrelated operational traffic is rejected.

Nothing is deleted on reopening: original close runs, snapshots, exceptions
and history all remain queryable.
