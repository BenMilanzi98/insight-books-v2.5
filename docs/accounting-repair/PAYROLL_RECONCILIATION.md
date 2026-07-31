# Payroll Reconciliation

Comparison set: payroll runs, gross salaries, Salaries & Wages expense (5200),
PAYE payable, pension payable, other deductions, employer pension expense,
payroll payable, bank payments, employee subledger information.

| Pattern | Repair |
|---|---|
| Payroll run without journal | `MISSING_JOURNAL_REPAIR` from the run |
| Duplicate payroll journal | `DUPLICATE_EFFECT_REPAIR` |
| Salary expense split across conflicting accounts | 5200 reclassification (`WRONG_ACCOUNT_REPAIR.md`) — liabilities never moved into 5200 |
| PAYE posted as expense instead of liability | `RECLASSIFICATION_REPAIR` (Dr PAYE-expense-error / Cr PAYE payable direction per case) |
| Pension posted incorrectly | `RECLASSIFICATION_REPAIR` |
| Net pay posted twice | `DUPLICATE_EFFECT_REPAIR` |
| Payroll payment missing | `MISSING_JOURNAL_REPAIR` from the bank evidence |
| Employee dimension missing | Dimension repair |
| Payroll liability not cleared | Investigation → missing payment journal vs genuine outstanding liability (no invention) |
| Cancelled payroll included | `REPORT_ONLY_REPAIR` |
| Cross-business employees | `CROSS_BUSINESS_REPAIR` |
| `PAYROLL_CONTROL_DIFFERENCE` residual | Exception |

Acceptance: payroll expense and payroll liabilities reconcile to runs;
historical reclassifications preserve total expense (verified via snapshot
deltas); salary expense uses approved mappings.
