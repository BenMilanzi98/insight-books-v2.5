# Period Report Snapshots

Integration with the Phase 7 snapshot framework (`AcctV2ReportRun` +
approval/integrity statuses).

## At closure

`closePeriod` generates (or links) report runs for the period: Trial
Balance, Income Statement, Statement of Financial Position, Cash Flow
Statement and Statement of Changes in Equity, plus the reconciliation
results (AR/AP/inventory/payroll/loan controls), exception register and the
close checklist itself. The close run stores `snapshotReference` and each
run stores: business, period boundaries, financial year, report definition
version, data/mapping versions, integrity status, approval, generated date
and checksum (Phase 7 fields).

## Immutability and supersession

- Approved snapshots are immutable (Phase 7 guarantee).
- Reopening marks period snapshots superseded together with the close run —
  **nothing is deleted**; the UI and APIs can still retrieve the original
  generation.
- Re-close generates a new snapshot set tied to the new close run version.

Report boundaries and journal boundaries are identical by construction: both
the reporting engine and the resolver read the same
`AcctV2AccountingPeriod.startDate/endDate` values.
