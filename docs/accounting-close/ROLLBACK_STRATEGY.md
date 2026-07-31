# Phase 12 Rollback Strategy

## Allowed

- Disable `accountingCloseV2Enabled` / related CLOSE_FLAGS with an explicit
  `AcctV2FeatureFlag` row (`enabled: false`) — they are pre-enabled by default.
- Revert UI/API deployment.
- Preserve CloseV2 runs, posted Closing Journals, snapshots, PCTB rows.
- Use controlled reopen if accounting reversal is required.

## Forbidden

- Delete posted Closing Journals or year-end adjustments.
- Delete annual snapshots.
- Directly reset Retained Earnings.
- Recreate duplicate opening balances.
- Mark a year OPEN without status history.
- Hide failed close records.
- Modify historical journal amounts.
