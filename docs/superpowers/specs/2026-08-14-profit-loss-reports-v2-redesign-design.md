# Profit & Loss redesign in `/reports-v2` (FreshBooks-style)

**Date:** 2026-08-14  
**Status:** Approved in conversation (layout + engine); written for review  
**Scope:** Full feature parity for Profit & Loss only, embedded in `/reports-v2` when `INCOME_STATEMENT` is selected

## Decisions locked

| Topic | Choice |
| --- | --- |
| Scope | **B** — full feature parity (UI + engine) |
| Placement | **A** — stay in `/reports-v2`; swap main panel for P&L experience |
| Accounting method | **B** — real cash-basis P&L (Collected) in addition to Accrual |
| More Actions / Send | **A** — export CSV/XLSX/PDF + print; Send enabled only if report email exists (today: disabled + tooltip) |

## Problem

Today’s P&L in `/reports-v2` is a single-period statement with shared from/to controls. Users want a FreshBooks-like layout: preview + right-hand Filters, month/quarter columns, accrual vs cash, breakdown mode, and currency.

## Goals

- Screenshot-similar UX for Profit & Loss inside the existing reports hub.
- Month or quarter **period columns** from the Financial Reporting Engine.
- **Accrual** and **Cash (Collected)** accounting methods with clear labeling.
- Breakdown **By Account** and **By Transaction type**.
- Apply / Reset filter workflow; export of the applied view.
- Other report types keep the current shared UI.

## Non-goals

- Redesigning Balance Sheet, Cash Flow, or other report types to this layout (v1).
- Dedicated `/reports-v2/profit-loss` route (explicitly declined).
- Building a new email-send pipeline if none exists (Send stays disabled with tooltip).
- Changing Accounting V2 posting rules.

## UX / layout

When `selected.type === 'INCOME_STATEMENT'`:

1. **Page chrome (within reports-v2 main column)**  
   - Title: “Profit and Loss”  
   - Actions: **More Actions** dropdown (CSV, XLSX, PDF, Print); **Send…** (disabled + tooltip unless a send capability exists)

2. **Main card** — two columns:  
   - **Left — Report preview:** blue report title, tenant name, method subtitle (`Income Billed` / `Income Collected` + currency), period string, expand control, periodized table.  
   - **Right — Filters:** Date range (presets + custom), Group by Month/Quarter, Accounting Method Accrual/Cash, Breakdown By Transaction type / By Account, Currency (existing reporting currency selector), Reset all / Close / Apply.

3. **Table structure**  
   - Rows follow IS definition groups (Revenue/Income, COGS, Gross Profit, Gross Margin %, Expenses, Net Profit) with expandable children.  
   - Columns: label + one column per period + Total.  
   - Amounts drill to existing drill-down where line ids map.

4. **Mobile**  
   - Filters collapse behind a Filters button; table scrolls horizontally.

## Engine / API

### Request params (generate + export)

Extend generate/export for `INCOME_STATEMENT`:

- `groupBy`: `MONTH` | `QUARTER` (default `MONTH`)
- `accountingMethod`: `ACCRUAL` | `CASH` (default `ACCRUAL`)
- `breakdown`: `ACCOUNT` | `SOURCE_TYPE` (default `ACCOUNT`)
- `currency`: existing reporting currency param if already supported
- Existing: `fromDate`, `toDate`, `includeZeroBalances`, branch scope

### Response shape (additive)

```ts
{
  // existing envelope fields…
  periods: Array<{ key: string, label: string, from: string, to: string }>,
  lines: Array<{
    // existing line fields…
    periodAmounts: Array<{ key: string, amount: Money }>, // aligned to periods
    children?: Array<Line>, // accounts or sourceType rows when expanded/breakdown
  }>,
  meta: {
    accountingMethod: 'ACCRUAL' | 'CASH',
    groupBy: 'MONTH' | 'QUARTER',
    breakdown: 'ACCOUNT' | 'SOURCE_TYPE',
    methodLabel: string, // e.g. "Income Billed (MWK)"
  }
}
```

### Accrual periodization

- Split `[fromDate, toDate]` into calendar month or quarter buckets.
- For each bucket, aggregate posted V2 journal lines using the same IS account mapping as `generateIncomeStatement`.
- Prefer one efficient multi-period query (group by account + period) over N full statement calls when feasible; fallback to N calls only if needed for correctness.

### Cash (Collected) basis

- Include only journal lines that involve **cash/bank** (payment) accounts in the period.
- Attribute P&L impact from the **non-cash counter lines** on the same journal (revenue/expense nature), mapped into IS groups.
- Exclude pure non-cash journals (e.g. depreciation-only) from cash-basis columns.
- Footer note: “Cash basis includes activity that settled through cash/bank accounts in the period.”
- Integrity status remains visible; cash basis may surface additional warnings if mapping is incomplete.

### Breakdown

- **ACCOUNT:** child rows = CoA accounts under each group (codes + names).  
- **SOURCE_TYPE:** child rows = journal `sourceType` (or equivalent) totals under each group.

### Filters Apply semantics

- Draft filter state in UI; **Apply** triggers generate with current draft.  
- Auto-load on first enter P&L with defaults: This Year, Month, Accrual, By Account, tenant currency.  
- **Reset all** restores defaults (does not auto-apply until Apply, or apply immediately — prefer apply immediately for Reset).

## Components / files

| Unit | Responsibility |
| --- | --- |
| `app/reports-v2/page.js` | Detect `INCOME_STATEMENT`; render `ProfitLossReportView` instead of shared period/table panel |
| `components/reports/ProfitLossReportView.jsx` | Layout shell: header actions + preview + filters |
| `components/reports/ProfitLossFilters.jsx` | Filter sidebar controls |
| `components/reports/ProfitLossTable.jsx` | Periodized table + expand + margin row |
| `lib/accountingV2/reporting/incomeStatementPeriodService.js` (or extend `financialStatementService.js`) | Period buckets + multi-period accrual aggregates |
| `lib/accountingV2/reporting/incomeStatementCashBasis.js` | Cash-basis attribution rules |
| Generate/export API routes | Accept and pass new params; export includes period columns |

Keep presentation out of API routes; keep cash rules unit-tested independently of React.

## Acceptance criteria

- [ ] Selecting Profit & Loss shows screenshot-like preview + Filters sidebar; other reports unchanged.
- [ ] Group by Month/Quarter produces correct period columns for the selected range.
- [ ] Accrual totals for the full range reconcile to today’s single-period IS (within rounding) when summing period columns.
- [ ] Cash method changes figures and labels to Collected; non-cash journals do not inflate cash P&L.
- [ ] Breakdown toggles Account vs Transaction type child rows.
- [ ] Apply / Reset behave as specified; currency selector uses existing reporting currency plumbing.
- [ ] More Actions exports/print work for the applied view; Send disabled with tooltip if no email send exists.
- [ ] Mobile: filters usable; table horizontally scrollable.

## Risks

- Cash-basis attribution from counter-lines can be ambiguous on multi-leg journals → define deterministic allocation (pro-rata by absolute non-cash line amount) and document.
- Large date ranges × many accounts → need efficient aggregation to avoid N+1 statement generation.
- Export PDF width with many month columns → allow landscape / horizontal scroll in HTML print.

## Out of scope follow-ups

- Email Send pipeline for financial reports.
- Applying this layout to Balance Sheet / other statements.
- Transaction-type taxonomy UI customization.

## Open questions

None — decisions locked in conversation 2026-08-14.
