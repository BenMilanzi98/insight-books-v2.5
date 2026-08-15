# BF Phase 2 Forecasting Implementation Plan

> **For agentic workers:** Implement task-by-task. Visual-only POS parity is out of scope.

**Goal:** Complete forecasting methods UI/engine so owners can create, regenerate, and edit monthly projections.

**Architecture:** Pure `projectForecastAmount` helper + extend `forecastService`; add lines PUT route; mirror Phase 1 budget wizard/grid UX on forecasts pages.

**Tech Stack:** Next.js App Router, Prisma Forecast/ForecastLine, vitest, existing BfShell.

## Global Constraints

- Never post projected amounts to the GL
- Extend greenfield module only; no schema migration
- Phase 3 (AR/AP, assumptions CRUD, alerts) out of scope

---

### Task 1: Projection helper + tests

**Files:**
- Create: `lib/budgetForecast/domain/forecastProjection.js`
- Create: `test/budgetForecast/forecastProjection.test.js`
- Modify: `lib/budgetForecast/application/forecastService.js` (use helper in `runGenerationIntoForecast`)

- [ ] Implement `projectForecastAmount({ method, historical, budgetAmt, periodsCount, actualsMonths, growthPercent, scenarioFactor, recurringAmount })`
- [ ] Cover CURRENT_RUN_RATE, HISTORICAL_AVERAGE, BUDGET_REMAINDER, RECURRING, MANUAL
- [ ] Wire into generation loop; MANUAL creates zero-spread lines for each actuals account
- [ ] Run `npx vitest run test/budgetForecast/forecastProjection.test.js`

### Task 2: Lines API + dashboard cards

**Files:**
- Create: `app/api/budget-forecast/forecasts/[id]/lines/route.js`
- Modify: `lib/budgetForecast/application/forecastService.js` (`getForecastDashboard`)

- [ ] PUT lines → `saveForecastLines`
- [ ] Dashboard sums projected amounts by account type (revenue/expense/profit) from most recent GENERATED/APPROVED/ACTIVE forecast
- [ ] Return `primaryForecastId` for report link

### Task 3: Creation wizard UI

**Files:**
- Modify: `app/budget-forecast/forecasts/page.js`

- [ ] Method + type selectors, source budget list, growth, department
- [ ] Cards + link to `/budget-forecast/reports?reportId=BVF&forecastId=`

### Task 4: Detail regenerate + monthly grid

**Files:**
- Modify: `app/budget-forecast/forecasts/[id]/page.js`

- [ ] Regenerate form (method, growth, sourceBudgetId, scenarioType)
- [ ] Editable monthly grid + save via PUT lines
- [ ] Keep workflow action buttons

### Task 5: Verify

- [ ] `npx vitest run test/budgetForecast`
- [ ] Manual smoke: rolling + remainder + manual month edit
