# Backdating Controls

## Definition

A posting is backdated when its resolved period ends before the period
containing today (prior-period posting). Earlier dates within the current
open period are ordinary postings.

## Policy options (`backdatingPolicy` in calendar config)

| Policy | Behaviour |
| --- | --- |
| `REJECT` | no posting dated before today |
| `PERMISSION` | requires `accountingPeriods.postBackdated` |
| `PERMISSION_AND_REASON` (default) | permission **and** a reason string |
| `OPEN_PERIOD_ONLY` | prior period must be OPEN/REOPENED (it always must be) |

## Enforcement (`resolvePeriodV2` step 5)

- Target period must be OPEN or formally REOPENED (a CLOSED prior period is
  a `ClosedAccountingPeriodError` regardless of permission).
- Missing permission → `InvalidPostingDateError` "requires backdating
  permission"; missing reason → "requires a reason".
- REOPENED targets additionally require adjustment authorization
  (`accountingPeriods.postAdjustments`).
- Every rejection audits `acctv2.period.postingRejected` with reason code
  `BACKDATING_*`; every allowed backdated resolution returns
  `isBackdated: true` so the journal records it (late-posting detection).

Imports and APIs cannot hide backdating: the payload date always flows
through the same evaluation.
