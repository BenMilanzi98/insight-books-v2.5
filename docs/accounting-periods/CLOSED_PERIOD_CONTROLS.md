# Closed-Period Controls

Once a period is CLOSED, `resolvePeriodV2` throws `ClosedAccountingPeriodError`
for every ordinary posting attempt — invoice, payment, bill, expense, payroll,
inventory, bank, asset, depreciation, loan, tax, capital and manual journal
events all resolve through the same service, so all are rejected uniformly.

Journal edit/delete protection comes from Phase 4 journal immutability
(posted journals are never updated or deleted; corrections are reversals or
adjustments), combined with period resolution rejecting the reversal/
adjustment's own posting date when it falls in a closed period.

## Still allowed

- Read access, report access, export, audit access.
- Reopening requests (`accountingPeriods.requestReopen`).
- Approved **current-period** adjustments that reference the closed period
  (Phase 4 adjustment journal framework — the adjustment posts into an open
  period).

## Error response (`ClosedAccountingPeriodError`)

Carries period name, period dates, financial-year code, requested posting
date, source module, reopening/adjustment guidance, a safe user-facing
message, request ID and correlation ID — no database internals. Every
rejection is audited (`acctv2.period.postingRejected`, reason
`PERIOD_CLOSED`), giving the monitoring job its closed-period-attempt metric.
