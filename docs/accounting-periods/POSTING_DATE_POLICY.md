# Posting Date Policy

`evaluatePostingDate` (`datePolicy.js`) + `resolvePeriodV2`
(`periodResolutionService.js`).

## Evaluation pipeline (server-side, per posting)

1. Normalize the requested posting date (default: transaction date) to
   date-only UTC in the business timezone.
2. Classify: backdated (before today / prior period), future-dated (after
   today), same-day.
3. Apply the business backdating policy (`REJECT`, `PERMISSION`,
   `PERMISSION_AND_REASON`, `OPEN_PERIOD_ONLY`).
4. Apply the future-dating policy (`REJECT`, `TOLERANCE_WITH_WARNING`,
   `ALLOW_WITH_PERMISSION`) with `futureToleranceDays`.
5. Apply lock dates: business default lock rules and the resolved period's
   `lockDate` — postings on or before a lock date are rejected regardless of
   OPEN status.
6. Resolve financial year and period; validate statuses and permissions.

## Outcome recorded on every resolution

`requestedPostingDate`, `resolvedPostingDate`, `resolutionRule`,
`isBackdated`, `isFutureDated`, `requiresApproval`, `warnings`, user,
`requestId`, `correlationId`. Rejections are additionally audited as
`acctv2.period.postingRejected` with the reason code.

## Frontend contract

The client may *request* a date; it cannot override the resolved date or the
resolved period. `POST /api/accounting-v2/periods/resolve` offers a safe
dry-run (`validatePostingDate`) so forms can warn users before submission.
