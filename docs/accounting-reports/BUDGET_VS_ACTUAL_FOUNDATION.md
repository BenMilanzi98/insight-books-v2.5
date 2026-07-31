# Budget versus Actual Foundation

`generateBudgetVsActual` in `subledgerReportsService.js`.

- **Actuals** come exclusively from the General Ledger (period movement per
  account, revenue-signed positive).
- **Budgets** live in the separate budget data model (`BudgetItem` rows joined
  to business-scoped active/approved budgets). Budget records never post to
  the General Ledger.
- Per account line: actual amount, budget amount, variance
  (`budgetVariance = actual − budget`), variance percentage, and a
  favourable/unfavourable flag in metadata.
- Scope: business, period window, branch; account-level lines carry codes,
  names and drill-down references.

Fixture assertion: revenue account 4000 — actual 100,000 vs budget 120,000 →
variance −20,000, unfavourable.

Full budgeting workflows (budget authoring, approvals, department/project
budget dimensions, revised budgets) are later work; this foundation fixes the
reporting contract they must feed.
