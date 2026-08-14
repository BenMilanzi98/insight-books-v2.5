# Budget & Forecast — POS visual parity

**Date:** 2026-08-14  
**Status:** Approved (conversation); awaiting spec file review  
**Scope:** All Budget & Forecast UI under `/budget-forecast` (list, detail, reports)

## Problem

Budget & Forecast already wraps pages in `BfShell` with `PosStylePageHeader` / `PosStylePanel`, but inner surfaces still use plain white cards (`rounded-xl border bg-white`), slate primary buttons (`bg-slate-900`), and muted table headers. They look flatter than `/pos` and other modules that use glass cards, gradient accent bars, and richer CTAs.

## Goals

- Match the **visual language** of `/pos` and existing POS-parity shells across **every** BF page.
- Keep behavior, APIs, permissions, and copy unchanged.
- Prefer shared helpers so future BF screens stay consistent.

## Non-goals

- Sidebar / nav chrome for “Budget & Forecast”
- New forecasting/budget features or report logic
- Redesigning POS itself
- Changing data models or Accounting V2 posting rules

## Approach

**Shared BF visual kit (Approach 1)** — extend `components/budget-forecast/BfShell.js` (and thin siblings if needed) and restyle all BF pages to use:

| Building block | Source | Use |
| --- | --- | --- |
| Page header | `PosStylePageHeader`, `PosStyleHeaderButton` | Titles, secondary actions |
| Content panels | `PosStylePanel` (`accent`: default / green / rose / false) | Lists, forms, tables, report results |
| KPI cards | existing `SummaryCard` → `StatCard` / `ClickableStatCard` | Dashboard and report totals; optional distinct `barClassName` for revenue / expense / profit |
| Primary CTA | gradient button classes aligned with POS (blue/emerald) | Create, save, run report, lifecycle commands |
| Section tabs | restyle `BfShell` tab strip | Active = brand/primary fill or blue gradient; inactive = glass hover |
| Tables | glass panel + `thead` `bg-gradient-to-r from-gray-50 to-gray-100` | Budget lines, forecast months, report lines |

## Pages in scope

1. `/budget-forecast/budgets` — KPI grid, budget list, create form  
2. `/budget-forecast/forecasts` — KPI grid, forecast list, generate form  
3. `/budget-forecast/reports` — filters panel, run/CSV actions, result KPIs + result table  
4. `/budget-forecast/budgets/[id]` — summary cards, account/line editor, action buttons, tables  
5. `/budget-forecast/forecasts/[id]` — cash/line tables, action buttons  
6. `/budget-forecast` hub (if present) — same shell treatment if it renders content  

Legacy `/budget/*` redirects (if any) are out of visual scope unless they still render BF UI.

## Visual rules

1. **No plain white cards** for primary content: use `PosStylePanel` / `tenant-glass-card` (+ accent where it marks a primary surface).  
2. **Primary buttons:** not `bg-slate-900`; use POS-like gradient / brand primary (e.g. `bg-gradient-to-r from-blue-600 to-indigo-600` or emerald for constructive “save/create”).  
3. **Secondary buttons:** `PosStyleHeaderButton` or equivalent glass outline.  
4. **Tabs:** active state must read as POS-colored (not flat black slate pill unless that matches an existing POS control — prefer brand blue).  
5. **Tables:** wrap in accent panel; gradient thead; keep monospace codes; preserve `StatusBadge` tones.  
6. **Alerts:** keep red/emerald soft banners; optional rose accent panel for errors is fine.  
7. **Density:** planning tables stay readable — do not clone POS “cart floor” layout.

## Implementation notes

- Centralize repeated class strings in `BfShell` exports (`BfPrimaryButton`, `BfTable`, or documented class constants) to avoid drift.  
- Reuse `components/shell/PosStylePanel.jsx` and `PosStylePageHeader.jsx`; do not fork CSS.  
- Align with prior POS theming specs: `2026-08-11-pos-visual-parity-accounting-pages-design.md`, `2026-08-12-tenant-pos-theming-unification-design.md`.  
- `insight/app/budget-forecast/**` mirrors: update only if that tree is still shipped; prefer single source under `app/budget-forecast` + shared components.

## Acceptance criteria

- [ ] Budgets, Forecasts, Reports list pages use glass panels and non-slate primary CTAs.  
- [ ] Budget and Forecast detail pages use the same panel/table/button language.  
- [ ] Report result table sits in a POS-style panel with gradient header row.  
- [ ] `BfShell` tabs visibly match POS color energy (active ≠ muted slate-only).  
- [ ] No API, permission, or calculation behavior changes.  
- [ ] Mobile: headers stack, tables remain horizontally scrollable inside panels.

## Risks

- Over-accenting every nested box → prefer accent on major panels only.  
- Duplicate `insight/` copies falling behind → check once during implementation.

## Open questions

None — scope **C** and Approach **1** approved in conversation (2026-08-14).
