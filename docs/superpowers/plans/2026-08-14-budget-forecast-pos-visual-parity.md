# Budget & Forecast POS Visual Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all `/budget-forecast` pages so inner panels, tabs, tables, and CTAs match `/pos` glass + gradient visual language.

**Architecture:** Extend `components/budget-forecast/BfShell.js` with shared button/panel/table helpers; replace plain white/`bg-slate-900` chrome on list and detail pages. No API or behavior changes.

**Tech Stack:** Next.js App Router, React client components, Tailwind, existing `PosStylePanel` / `PosStylePageHeader` / `StatCard`.

## Global Constraints

- Visual-only: no API, permission, or calculation changes.
- Scope C: Budgets, Forecasts, Reports list + detail + report result tables.
- Reuse `PosStylePanel` / `tenant-glass-card`; do not fork CSS.
- Primary CTAs: blue/indigo or emerald gradients — never `bg-slate-900`.
- Spec: `docs/superpowers/specs/2026-08-14-budget-forecast-pos-visual-parity-design.md`

---

### Task 1: BF shared visual helpers

**Files:**
- Modify: `components/budget-forecast/BfShell.js`
- Test: `test/bfShellVisual.test.js` (node:test — assert exported class constants / helper classNames)

**Interfaces:**
- Produces: `BfPrimaryButton`, `BfSecondaryButton` (re-export or wrap `PosStyleHeaderButton`), `BfTableShell`, `BF_PRIMARY_BTN_CLASS`, `BF_TAB_ACTIVE_CLASS`, `BF_TAB_IDLE_CLASS`, `BF_THEAD_CLASS`
- Consumes: `PosStylePanel`, `PosStyleHeaderButton`, `cn` from `@/lib/utils`

- [ ] **Step 1:** Add helpers and restyle tabs in `BfShell.js`:

```js
export const BF_PRIMARY_BTN_CLASS =
  'inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60';

export const BF_PRIMARY_SUCCESS_BTN_CLASS =
  'inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-green-600 to-green-700 px-3 py-2 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60';

export const BF_TAB_ACTIVE_CLASS =
  'rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-sm font-medium whitespace-nowrap text-white shadow-md';

export const BF_TAB_IDLE_CLASS =
  'rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-slate-600 hover:bg-white/80 hover:shadow-md';

export const BF_THEAD_CLASS =
  'bg-gradient-to-r from-gray-50 to-gray-100 text-left text-xs uppercase tracking-wide text-slate-600';

export function BfPrimaryButton({ success = false, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`${success ? BF_PRIMARY_SUCCESS_BTN_CLASS : BF_PRIMARY_BTN_CLASS} ${className}`}
      {...props}
    />
  );
}

export function BfSecondaryButton(props) {
  return <PosStyleHeaderButton {...props} />;
}

export function BfTableShell({ children, accent = 'default', className = '' }) {
  return (
    <PosStylePanel accent={accent} className={`overflow-x-auto ${className}`}>
      {children}
    </PosStylePanel>
  );
}
```

Update tab `Link` classNames to use `BF_TAB_ACTIVE_CLASS` / `BF_TAB_IDLE_CLASS`. Export `PosStyleHeaderButton` usage for migrate/secondary actions.

- [ ] **Step 2:** Add `test/bfShellVisual.test.js` asserting constants contain `from-blue-600` and do not contain `slate-900`.

- [ ] **Step 3:** Run `node --test test/bfShellVisual.test.js` — expect PASS.

- [ ] **Step 4:** Commit helpers + test.

---

### Task 2: List pages (Budgets, Forecasts, Reports)

**Files:**
- Modify: `app/budget-forecast/budgets/page.js`
- Modify: `app/budget-forecast/forecasts/page.js`
- Modify: `app/budget-forecast/reports/page.js`

**Interfaces:**
- Consumes: `BfPrimaryButton`, `BfSecondaryButton`, `BfTableShell`, `PosStylePanel`, `SummaryCard`

- [ ] **Step 1:** On each list page, wrap list/form/filter/result sections in `PosStylePanel` (accent default or green for create forms). Replace `bg-slate-900` submits with `BfPrimaryButton` / success variant. Use `BfSecondaryButton` for migrate/CSV. Wrap report result table in `BfTableShell` with `BF_THEAD_CLASS` on thead row.

- [ ] **Step 2:** Manually spot-check in browser: `/budget-forecast/budgets`, `/forecasts`, `/reports`.

- [ ] **Step 3:** Commit list page restyles.

---

### Task 3: Detail pages

**Files:**
- Modify: `app/budget-forecast/budgets/[id]/page.js`
- Modify: `app/budget-forecast/forecasts/[id]/page.js`

**Interfaces:**
- Consumes: same helpers as Task 2

- [ ] **Step 1:** Replace header action borders with `BfSecondaryButton`; Save lines / Generate constructive actions with `BfPrimaryButton` (success for save). Wrap CoA picker, planner, cash-flow and lines tables in `PosStylePanel` / `BfTableShell` + gradient thead.

- [ ] **Step 2:** Spot-check detail routes.

- [ ] **Step 3:** Commit detail restyles.

---

### Task 4: Acceptance pass

- [ ] Confirm no `bg-slate-900` remain under `app/budget-forecast`.
- [ ] Confirm no plain `rounded-xl border bg-white` primary content cards remain (alerts OK).
- [ ] Run `node --test test/bfShellVisual.test.js`.
- [ ] Final commit if any leftovers.

## Spec coverage

| Spec item | Task |
| --- | --- |
| Shared BF kit | 1 |
| Tabs colored | 1 |
| List pages glass + CTAs | 2 |
| Report result table | 2 |
| Detail pages | 3 |
| No behavior change | all (class-only) |

## Placeholder scan

None intentional.
