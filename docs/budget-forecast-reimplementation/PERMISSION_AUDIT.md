# Permission Audit

## Current

| Module | Actions | Wired in role templates |
|--------|---------|-------------------------|
| `budgets` | create, view, update, delete, approve, export | Yes (`defaultRoleTemplates`) |
| `financialPlanning.*` | Fine-grained | **No** in default templates |

## Page / API gates

- Pages: `/budget-forecast` → `budgets.view`
- API: `/api/bf`, `/api/budgets`, `/api/budget-forecast` (rule exists, handlers missing) → `budgets.*`
- `/financial-planning` page rule missing from `tenantPageAccess` (gap)

## Greenfield target

Keep module key `budgets` for compatibility; add actions: `submit`, `lock`, `unlock`, `revise`, `generateFromActuals`, `import`, plus forecast-oriented `forecastView` / `forecastManage` mapped as `budgets.view` / `budgets.update` aliases where needed. Enforce on every command API.
