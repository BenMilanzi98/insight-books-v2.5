# Current Implementation Audit

**Date:** 2026-07-23  
**Scope:** Budget & Forecast, Financial Planning, legacy Budget APIs

## Summary

Three parallel planning stacks coexist. Product UX under Sidebar “Budget & Forecast” uses the BF stack (`/budget-forecast/*` + `/api/bf`). Financial Planning is a separate pilot. Legacy `/api/budgets` has no UI.

## Stack A — BF (Budget & Forecast)

| Item | Finding | Class |
|------|---------|-------|
| Routes | `/budget-forecast/budgets`, `/forecasts`, `/reports` + detail pages | REIMPLEMENT |
| Models | `BfExpenseBudgetHeader/Line`, `BfRevenueForecastHeader/Line` | MIGRATE → greenfield |
| Actuals | `bfActualsEngine` (TransactionLine + JournalEntryLine, Float) | DEPRECATE |
| Status | `draft` / `active` only | INCOMPLETE |
| Versioning | Forecast `version` string label only | INCOMPLETE |
| Approvals / lock | None | INCOMPLETE |
| Dimensions | No department/project/cost centre | INCOMPLETE |

## Stack B — PlanV2 (Financial Planning)

| Item | Finding | Class |
|------|---------|-------|
| UI | `/financial-planning` single page | DEPRECATE (redirect) |
| Models | `PlanV2Budget`, `PlanV2ForecastVersion`, assumptions, scenarios | MIGRATE concepts |
| Account FK | `PlanV2BudgetLine.accountId` optional, no FK | UNSAFE / INCORRECT |
| Actuals | Prefers snapshots; forbids ops tables | EXTEND patterns into greenfield |

## Stack C — Legacy Budget

| Item | Finding | Class |
|------|---------|-------|
| Models | `Budget`, `BudgetItem`, `RevenueBudgetBreakdown` | RENAME → Legacy* then DEPRECATE |
| Actuals | Stored `actualAmount` on items; TransactionLine only | INCORRECT |
| UI | `/budget/*` redirects to BF | LEGACY_READ_ONLY |

## Critical gaps vs master prompt

1. No immutable approved budget versions  
2. No controlled state machine (arbitrary status possible on legacy)  
3. Actuals not exclusively Accounting V2  
4. Expense vs revenue split across two BF header types  
5. Duplicate planning UX (BF vs Financial Planning)  
6. Parent/child double-count rules not enforced in BF planner  
7. Cash flow / AR / AP / scenario planning incomplete on BF surface  
