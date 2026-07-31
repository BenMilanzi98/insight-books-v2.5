# Planning Data Flow Map

## Actuals (read-only)

```
Closed-period / annual snapshots (preferred)
  → Canonical Financial Reporting Engine (IS / BS / CF)
  → Canonical GL Query Service
  → Historical Financial Dataset (PlanV2)
  → Quality assessment (confidence)
```

Forbidden as Actual truth: invoice totals, expense-table totals, stored BudgetItem.actualAmount as GL authority.

## Planning (write path — never to GL)

```
Planning Configuration
  → Budget version (immutable when APPROVED)
  → Forecast Cycle + Scenario + Assumption Set version
  → Baseline / driver calculation
  → Three-Statement Projection Engine
  → Integrity validation (P&L / CF / BS)
  → Review → APPROVED Forecast version (immutable)
  → Snapshot
  → Actual-vs-Forecast / Budget-vs-Actual (comparison only)
```

## Three-statement order

1. Opening BS  
2. Revenue → COS → OpEx → EBITDA → Dep → Interest → Tax → Net Profit  
3. AR / Inventory / AP / other WC  
4. Capex / FA / Dep schedules  
5. Loans / equity / dividends / drawings  
6. Cash Flow → Closing Cash  
7. Balance Sheet (must balance; Cash = CF closing)  
8. KPIs + integrity  

## Overrides / AI

```
AI suggestion (draft) → human accept → structured Assumption
Manual override → reason → optional approval → applied value beside calculated
Never: AI/override direct JournalEntry write
```
