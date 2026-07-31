# Target Loan Readiness Architecture

See `LOAN_READINESS_DATA_FLOW_MAP.md`.

Separation:

| Layer | Storage | Posts to GL? |
|---|---|---|
| Actuals | JE / snapshots / Liability register | Yes (ops only) |
| Forecasts | PlanV2* | No |
| Assessments / scores / schedules | LrdV2* | No |
| Proposed facilities | Assessment payload | No |

Engines are server-side only; React displays results.
