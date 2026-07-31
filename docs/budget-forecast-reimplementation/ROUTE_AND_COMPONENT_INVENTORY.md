# Route and Component Inventory

## Product routes (target)

| Route | Current file | Class |
|-------|--------------|-------|
| `/budget-forecast` | `app/budget-forecast/page.js` | EXTEND (redirect to budgets) |
| `/budget-forecast/budgets` | `app/budget-forecast/budgets/page.js` | REIMPLEMENT |
| `/budget-forecast/budgets/[id]` | `app/budget-forecast/budgets/[id]/page.js` | REIMPLEMENT |
| `/budget-forecast/forecasts` | `app/budget-forecast/forecasts/page.js` | REIMPLEMENT |
| `/budget-forecast/forecasts/[id]` | `app/budget-forecast/forecasts/[id]/page.js` | REIMPLEMENT |
| `/budget-forecast/reports` | `app/budget-forecast/reports/page.js` | REIMPLEMENT |
| Layout / tabs | `layout.js`, `components/budget-forecast/BfShell.js` | REFACTOR |

## Redirect / deprecate

| Route | Action |
|-------|--------|
| `/budget/*` | Keep redirect to `/budget-forecast/*` |
| `/financial-planning` | Redirect to `/budget-forecast/forecasts` |

## APIs

| Prefix | Class |
|--------|-------|
| `/api/bf/*` | MIGRATE → `/api/budget-forecast/*` then DEPRECATE |
| `/api/budget-forecast/*` | NEW (primary) |
| `/api/budgets/*` | DEPRECATE after Legacy rename |
| `/api/financial-planning/*` | DEPRECATE product path |
| `/api/forecasts/*` | DEPRECATE heuristic endpoints |

## Components

Only `BfShell.js` is BF-specific today. List/detail/report logic is inline in pages — **REIMPLEMENT** as `components/budget-forecast/*` (dashboard, planner, wizard, report centre).
