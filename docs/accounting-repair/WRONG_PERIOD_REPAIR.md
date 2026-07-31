# Wrong Period Repair

A posted journal's period id is never edited. `PERIOD_ADJUSTMENT_REPAIR`
implements the approved treatments:

1. **Both periods open** — reverse in the original period, repost in the correct
   period (two engine postings under one anomaly, sequential repair versions).
2. **Original period closed** — post a prior-period adjustment in the earliest
   permitted open period; the affected historical period is recorded in journal
   metadata; disclosure metadata attached.
3. **Reopening** — never automatic. Requires the accounting-period module's own
   authorization (period controller), a documented reason, and re-close after
   repair.

Investigation records transaction date, original posting date, original and
correct period plus their statuses, financial year, tax impact and whether
statements were previously issued (issued statements escalate to prior-year
treatment, see `CLOSED_PERIOD_REPAIR_POLICY.md`).

Approval: Finance Manager + period controller, separation of duties (matrix).
The posting engine's period validation independently blocks any repair journal
targeting a closed period, so an unauthorized period change is rejected twice.

Missing-period-link defects (journals with no `accountingPeriodId` where one is
provable from the transaction date — detection `P6-PER-001`) are
`TECHNICAL_LINKAGE_ERROR` metadata repairs, not period adjustments: the money is
in the right period; only the link is absent.
