# Reopening Impact Analysis

`computeReopenImpact(db, context, periodId)` — computed automatically when a
reopen is requested and available on demand (`{action: 'impact'}` on the
period API; "View reopening impact" in the UI).

## Contents

- Journal count and total debits/credits in the period.
- Completed close runs (which will be superseded).
- Report runs / snapshots generated for the period (which will be superseded,
  not deleted).
- Downstream periods and later financial years whose opening balances and
  comparatives depend on the period.
- Open and accepted exceptions attached to the period's close runs.
- Pending reopen requests.

The impact is persisted on the reopen request (`impactJson`) so approvers see
exactly what was displayed at request time, and the approval audit references
it.
