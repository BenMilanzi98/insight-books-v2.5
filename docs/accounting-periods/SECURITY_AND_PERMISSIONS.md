# Security and Permissions

## Permissions (in `lib/accountingV2/permissions.js`)

`financialYears.view/.create/.configure/.open`;
`accountingPeriods.view/.beginClose/.completeTasks/.addEvidence/
.manageExceptions/.submitClose/.reviewClose/.approveClose/.close/
.requestReopen/.approveReopen/.reclose/.viewAudit/.viewSnapshots/
.exportClosePack/.overrideMateriality/.setLockDate/.postBackdated/
.postFutureDated/.postAdjustments/.migrate`.

Authorization is capability-based (permission strings resolved through the
existing framework), never by role name alone. Every route in
`app/api/accounting-v2/periods/**` declares its permission set and the
services re-check high-risk capabilities (`can(...)`) for waivers and
exception acceptance.

## Separation of duties

- Close approver ≠ close initiator (`approveCloseRun`).
- Reopen approver ≠ reopen requester (`approveReopen`).
- Blocking-task waivers require the distinct materiality-override permission.

## Multi-tenant isolation

Every table carries `tenantId`; every query in the periods services filters
by `context.businessId` (from the session — never from the request body).
Period, close-run, task, exception, reopen-request and snapshot lookups all
verify business ownership before acting; a foreign period ID behaves exactly
like a nonexistent one (security test: "cross-business period access").
Cache keys and outbox payloads include the business ID.
