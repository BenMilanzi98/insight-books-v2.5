# Projection Reports

Server-authoritative reports from `PlanV2ForecastVersion.resultPayload`:

- Projected Profit and Loss
- Projected Cash Flow
- Projected Balance Sheet
- KPIs / cash shortage / runway
- Scenario comparison (same model version)
- Variance (Actual vs Budget/Forecast via variance API)

UI: `/financial-planning`  
Export: `GET /api/financial-planning/forecasts/[id]/export?format=xlsx|json`

Screen and Excel use the same persisted `resultPayload` (no independent totals in export code).
