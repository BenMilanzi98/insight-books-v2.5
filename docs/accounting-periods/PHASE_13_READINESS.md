# Phase 13 Readiness — Forecasting

Forecasting can rely on:

- **Closed periods** as verified actuals: CLOSED status + completed close
  run + acceptable integrity status identify trustworthy months.
- **Verified report snapshots**: closed-period Income Statements, Balance
  Sheets and Cash Flows are immutable and checksummed (Phase 7 + 8).
- **Comparable months/quarters**: deterministic period numbers and identical
  boundaries between GL and reports make month-over-month and
  quarter-over-quarter comparisons safe; the Phase 7 comparative reporting
  API already accepts canonical period boundaries.
- **Financial-year boundaries**: canonical years (including non-January
  starts) define trend windows.
- **Late-posting visibility**: `isBackdated` resolution metadata lets
  forecasting distinguish original-period activity from late corrections.

Rule for Phase 13: forecast actuals must prefer verified closed-period
snapshot data; open-period data may be used only when explicitly labelled
provisional. Trend queries should select periods by
`AcctV2AccountingPeriod` IDs, never by raw date math.
