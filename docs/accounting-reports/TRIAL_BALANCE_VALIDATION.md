# Trial Balance Validation

## Accounting equations (all three enforced)

1. Total opening debit balances = total opening credit balances.
2. Total period debits = total period credits.
3. Total closing debit balances = total closing credit balances.

`generateTrialBalance` returns an `equations` block with each result and the
exact signed difference in minor units.

## When totals do not balance

- The difference is displayed exactly (`totals.difference`), never hidden.
- Affected accounts are listed (`affectedAccounts` — abnormal-balance rows).
- Integrity findings are attached (`integrityWarnings`), distinguishing
  `origin: 'CURRENT_SYSTEM'` (GL-1xx anomalies) from
  `origin: 'HISTORICAL_EXCEPTION'` (open Phase 6 anomaly registry rows,
  loaded by `loadOpenAccountingExceptions`).
- Status becomes UNBALANCED; envelope integrity becomes UNVERIFIED.
- `approveReportRun` refuses UNBALANCED/BLOCKED runs — an unbalanced Trial
  Balance can never be approved as accurate.
- **No automatic balancing journal is ever created** (verified by test: the
  journal stores are unchanged after generating an unbalanced report).

## Status definitions

| Status | Meaning |
| --- | --- |
| BALANCED | All three equations pass, no warnings |
| BALANCED_WITH_WARNINGS | Equations pass; non-blocking exceptions remain (e.g. open historical exceptions, abnormal balances) |
| UNBALANCED | Any equation fails; exact difference disclosed |
| BLOCKED | Structural integrity prevents reliable generation (GL-113: posted activity references an account missing from the business chart) |

Workflow statuses (GENERATED → REVIEWED → APPROVED → SUPERSEDED) are recorded
on the run row, not the computed status — approval never alters accounting
data.

## Test coverage

`test/accountingV2.reports.test.js` — "trial balance engine" suite: balanced
set, unbalanced legacy journal (exact 100.00 difference disclosed, no plug),
draft/void/mirror exclusion, opening reconciliation, zero-balance inclusion,
comparative periods, header non-double-counting.
