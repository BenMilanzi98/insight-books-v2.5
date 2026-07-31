# Wrong Account Repair

Amount correct, classification wrong → `RECLASSIFICATION_REPAIR`. The original
journal is never edited; historical account ids are never mutated.

Pattern (the canonical example):

```
Original (preserved):   Dr General Expenses    Cr Bank
Repair journal (HREP-): Dr Salaries & Wages    Cr General Expenses
```

Investigation records: original account and category, correct account and
category, source transaction, amount, tax treatment, period, business, report
and subledger impact, and whether control accounts (cash, AR, AP, inventory,
tax, equity) are involved — control-account involvement escalates to subledger
reconciliation review before approval.

For a completely invalid journal (not just misclassified): `REVERSAL_REPAIR`
plus a correct repost through the appropriate template.

## Salary account reclassification (Account 5200)

Per the Phase 3 Salary Account Cleanup Report, `5200 Salaries & Wages` is
canonical; historical salary expense in conflicting accounts (5230, "Payroll
Expense", "Wages Expense" variants) is reclassified:

- Confirm each transaction IS salary expense from payroll evidence — never
  reclassify on account name alone; exclude legitimate non-salary employee
  costs.
- Repair journal: Dr 5200 / Cr the conflicting expense account.
- PAYE, pension and payroll **liability** accounts are never moved into 5200.
- Verification proves total expense unchanged (Δdebit = Δcredit within the
  expense category) while classification improves; payroll summaries reconcile
  after reclassification.

Test coverage: salary reclassification end-to-end (original preserved, 5200
debited, conflicting account credited, totals preserved, idempotent replay).
