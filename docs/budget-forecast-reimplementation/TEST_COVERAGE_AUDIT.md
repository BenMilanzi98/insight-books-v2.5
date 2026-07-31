# Test Coverage Audit

## Existing

- Accounting V2 BvA foundation fixture (revenue variance)
- PlanV2 / financial planning tests (partial)
- No dedicated BF planner / approval / lock / multi-tenant BF tests found as a comprehensive suite

## Required greenfield suite (`test/budgetForecast/`)

- Domain: state machine, variance, utilization, completion, money
- Actuals: posted vs draft, signs, dimensions, hierarchy
- Budget commands: create, copy, generate, submit, approve, lock, revise
- Forecast: rolling, cash, scenarios, reproducibility
- Reports: BvA reconciliation, export match
- Security: IDOR, approve/lock bypass, tenant isolation
