# Budget & Forecast P&L-Simple Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve `/budget-forecast/` into an owner-friendly, account-based P&L-grouped budget/forecast with growth modes, period-aware variance, and PDF/Excel export.

**Architecture:** Reuse greenfield `PlanningBudget`/`PlanningForecast` and `INCOME_STATEMENT_V1` from `lib/accountingV2/reporting/reportDefinitions.js`. New `pnlBudgetLayout.js` groups account rows into P&L sections and computes profit lines. UI uses shared `PnlBudgetGrid.jsx`. Reports/export extend existing `reportService.js`.

**Tech Stack:** Next.js App Router, React, Prisma, Vitest, exceljs (export), existing PDF patterns from `lib/exportUtils.js`.

## Global Constraints

- Budgets/forecasts **never post journals**; actuals read-only from Accounting V2 ledger.
- P&L grouping uses **`INCOME_STATEMENT_V1`** match rules (`assignAccountsToLines`, `evaluateFormula`).
- **Simple default view** hides depreciation/finance/tax sections; expandable via toggle.
- Account rows remain real CoA lines; section pickers pre-filter by P&L match rules.
- Follow existing BF visual kit (`BfShell`, `PosStylePanel`, `BF_THEAD_CLASS`).

**Spec:** `docs/superpowers/specs/2026-08-18-budget-forecast-pnl-simple-design.md` (Approved)

---

### Task 1: P&L layout engine

**Files:**
- Create: `lib/budgetForecast/domain/pnlBudgetLayout.js`
- Test: `test/budgetForecast/pnlBudgetLayout.test.js`

**Interfaces:**
- Produces:
  - `buildPnlBudgetLayout({ accounts, selectedAccountIds, periodEdits, periodKeys, showAdvanced })` → `{ rows, summary }`
  - `filterAccountsForSection(allAccounts, sectionLineId, excludeAccountIds)` → `Account[]`
  - `SIMPLE_PNL_SECTIONS` — ordered section lineIds for default view

- [ ] **Step 1: Write failing tests**

```javascript
import { describe, it, expect } from 'vitest';
import { buildPnlBudgetLayout, filterAccountsForSection } from '../../lib/budgetForecast/domain/pnlBudgetLayout.js';

const rev = { id: 'a1', accountCode: '4010', accountName: 'Sales', accountType: 'income', coaV2Category: 'REVENUE' };
const cogs = { id: 'a2', accountCode: '5100', accountName: 'COGS', accountType: 'expense', coaV2Category: 'COST_OF_SALES' };
const rent = { id: 'a3', accountCode: '5210', accountName: 'Rent', accountType: 'expense', coaV2Category: 'EXPENSE' };

describe('buildPnlBudgetLayout', () => {
  it('groups accounts under revenue and opex sections', () => {
    const periodEdits = {
      a1: { '2026-01': '100' },
      a2: { '2026-01': '40' },
      a3: { '2026-01': '10' },
    };
    const { rows, summary } = buildPnlBudgetLayout({
      accounts: [rev, cogs, rent],
      selectedAccountIds: ['a1', 'a2', 'a3'],
      periodEdits,
      periodKeys: ['2026-01'],
      showAdvanced: false,
    });
    expect(rows.some((r) => r.rowType === 'SECTION' && r.lineId === 'revenue')).toBe(true);
    expect(rows.some((r) => r.rowType === 'ACCOUNT' && r.accountId === 'a1')).toBe(true);
    expect(summary.grossProfit).toBe(60);
    expect(summary.netProfit).toBe(50);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- test/budgetForecast/pnlBudgetLayout.test.js`

- [ ] **Step 3: Implement `pnlBudgetLayout.js`**

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit** (when user requests)

---

### Task 2: P&L budget grid component

**Files:**
- Create: `components/budget-forecast/PnlBudgetGrid.jsx`
- Modify: `app/budget-forecast/budgets/[id]/page.js`

**Interfaces:**
- Consumes: `buildPnlBudgetLayout`, `filterAccountsForSection`
- Props: `monthKeys`, `accounts`, `selectedAccountIds`, `periodEdits`, `onToggleAccount`, `onMonthChange`, `onAnnualChange`, `onSave`, `saving`, `showAdvanced`, `onShowAdvancedChange`

- [ ] Replace flat account sidebar + table with `PnlBudgetGrid`
- [ ] Per-section “Add account” dropdown (filtered picker)
- [ ] Calculated profit rows styled read-only (Gross / Total Expenses / Operating / Net)
- [ ] “Show advanced P&L lines” toggle
- [ ] Preserve existing save → `PUT /api/budget-forecast/budgets/[id]/lines`

---

### Task 3: Per-row growth modes (Phase B)

**Files:**
- Modify: `lib/budgetForecast/domain/forecastProjection.js`
- Modify: `lib/budgetForecast/application/budgetService.js` (`saveBudgetLines`)
- Modify: `components/budget-forecast/PnlBudgetGrid.jsx`
- Test: extend `test/budgetForecast/forecastProjection.test.js`

- [ ] Growth column: Manual | +% | +Fixed per account row
- [ ] Persist `sourceMethod`, `growthRate`, fixed increment on period amounts
- [ ] “Apply growth” button recalculates forward periods from anchor

---

### Task 4: Frequency-aware periods (Phase B)

**Files:**
- Modify: `lib/budgetForecast/application/budgetService.js`
- Modify: `app/budget-forecast/budgets/[id]/page.js`
- Modify: `lib/budgetForecast/domain/periods.js` consumers

- [ ] Use `buildPeriods(budget.frequency)` instead of hard-coded monthly keys
- [ ] Grid columns reflect MONTHLY / QUARTERLY / ANNUAL

---

### Task 5: P&L-grouped variance + period filter (Phase C)

**Files:**
- Modify: `lib/budgetForecast/application/reportService.js`
- Modify: `components/budget-forecast/BudgetForecastFilters.jsx`
- Modify: `components/budget-forecast/BudgetForecastReportView.jsx`
- Create: `lib/budgetForecast/domain/pnlVarianceLayout.js`
- Test: `test/budgetForecast/pnlVarianceLayout.test.js`

- [ ] Add granularity: month | quarter | year
- [ ] BVA report rows grouped like budget grid
- [ ] Insight banner (above/below budget summary)

---

### Task 6: Forecast grid parity (Phase D)

**Files:**
- Modify: `app/budget-forecast/forecasts/[id]/page.js`
- Reuse: `PnlBudgetGrid.jsx` (forecast mode prop)

- [ ] Same P&L layout for forecasts
- [ ] Projection summary cards (Income, Expenses, Gross, Operating, Net)

---

### Task 7: PDF & Excel export (Phase E)

**Files:**
- Create: `lib/budgetForecast/application/exportService.js`
- Create: `app/api/budget-forecast/reports/export/route.js`
- Modify: `components/budget-forecast/BudgetForecastReportView.jsx`

- [ ] `GET .../export?format=xlsx|pdf&reportId=BVA|BUDGET&budgetId=...`
- [ ] PDF: business name, period, assumptions, P&L table
- [ ] Excel: same structure, multiple sheets optional

---

## Spec coverage checklist

| Spec § | Task |
| --- | --- |
| P&L section grid | 1, 2 |
| Growth % / fixed / manual | 3 |
| Budget vs Actual variance | 5 |
| Month/quarter/year filter | 5 |
| Forecast projection | 6 |
| PDF/Excel export | 7 |
| Frequency (FY/period) | 4 |

## Self-review

- No TBD placeholders in tasks above.
- Types consistent: `buildPnlBudgetLayout` output consumed by `PnlBudgetGrid`.
- Phases A–E map to Tasks 1–2, 3–4, 5, 6, 7.
