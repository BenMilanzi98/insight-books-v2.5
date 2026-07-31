# Actual Data Authority

Financial Planning V2 consumes actuals only through:

1. Approved closed-period report snapshots (preferred)
2. Verified closed-period report results
3. Canonical posted General Ledger actuals
4. Provisional open-period actuals (clearly labelled)

Implemented in `lib/financialPlanning/application/historicalDatasetService.js`.

**Forbidden as financial actuals:** invoice totals, expense-table totals, payroll-table totals, inventory operational totals used as statement truth.

Operational data may inform non-financial drivers only after explicit mapping; it does not replace GL-based actuals.
