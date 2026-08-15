# BF Phase 3 Implementation Plan

**Goal:** Cash roll-forward, AR/AP methods, assumptions CRUD/apply, dashboard alerts.

**Architecture:** Pure domain helpers + thin services; extend forecastService/reportService; small assumptions API; UI wiring on forecasts pages.

## Tasks

1. Domain: `cashRollForward.js`, `arApSchedule.js`, `assumptionApply.js`, `forecastAlerts.js` + tests
2. `openBalancesService.js` — load open AR/AP minors by aging bucket
3. Extend `forecastProjection` + generation for OPEN_* and cash months persistence in notes JSON
4. Assumptions CRUD `/api/budget-forecast/assumptions`
5. Dashboard alerts in `getForecastDashboard`
6. UI: forecasts list/detail + report cash months
7. Vitest green
