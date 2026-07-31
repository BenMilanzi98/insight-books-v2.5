# Financial Planning API

Base path: `/api/financial-planning`

| Method | Path | Purpose |
|---|---|---|
| GET/PUT | `/config` | Planning configuration |
| GET | `/readiness` | Business readiness |
| GET | `/historical` | Historical dataset |
| GET/POST | `/scenarios` | List / create / clone |
| GET/PUT | `/assumptions` | Assumption sets |
| GET/POST | `/budgets` | Budgets |
| GET/POST | `/forecasts` | Cycles / versions / rolling |
| GET/POST | `/forecasts/[id]` | Get / calculate / approve / override |
| POST | `/project` | Stateless three-statement preview |
| GET/POST | `/ai` | Suggestions / review |
| POST | `/variance` | Line variance |

All routes use `guardPlanningRoute` + `financialPlanning.*` permissions. No raw formula execution endpoint.
