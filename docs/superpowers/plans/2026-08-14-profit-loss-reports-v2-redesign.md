# Profit & Loss reports-v2 redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FreshBooks-style Profit & Loss in `/reports-v2` with period columns, accrual/cash methods, account/source breakdown, and filter Apply workflow.

**Architecture:** Keep other report types on the shared UI. When `INCOME_STATEMENT` is selected, render `ProfitLossReportView`. Extend `normalizeReportRequest` + `generateIncomeStatement` for `groupBy`, `reportBasis` (ACCRUAL|CASH), and `breakdown`. Periodization loops bucket scopes through existing `buildIncomeStatementBody` (accrual) or a cash-basis body builder.

**Tech Stack:** Next.js, React, Tailwind, Accounting V2 reporting engine (`financialStatementService`, `reportContracts`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-14-profit-loss-reports-v2-redesign-design.md`
- P&L only inside `/reports-v2`; no dedicated route
- Real cash basis via cash/bank counter-line attribution
- Send… disabled with tooltip (no email pipeline)
- Other report types unchanged

---

### Task 1: Period buckets

**Files:**
- Create: `lib/accountingV2/reporting/periodBuckets.js`
- Test: `test/periodBuckets.test.js`

**Produces:** `buildPeriodBuckets(fromDate, toDate, groupBy)` → `{ key, label, fromDate, toDate }[]`

- [ ] Implement month/quarter UTC-safe buckets; test Jan–Mar and year spanning quarters
- [ ] Commit

### Task 2: Periodized + cash income statement

**Files:**
- Modify: `lib/accountingV2/reporting/financialStatementService.js` (export helpers / periodized path)
- Create: `lib/accountingV2/reporting/incomeStatementCashBasis.js`
- Modify: `lib/accountingV2/reporting/reportContracts.js` (`groupBy`, `breakdown`; keep `reportBasis`)
- Test: `test/incomeStatementPeriodize.test.js` (pure assembly of period minors)

**Produces:** Envelope with `periods`, `meta`, lines with `periodAmounts` (+ optional `children`)

- [ ] Accrual: per-bucket `buildIncomeStatementBody`, assemble periodAmounts; full-range currentAmount = sum
- [ ] Cash: journals touching cash accounts; attribute P&L counter-lines; same period assembly
- [ ] Wire `generateIncomeStatement` when `groupBy` set or always attach periods for IS when groupBy present
- [ ] Commit

### Task 3: API params

**Files:**
- Modify: `app/api/accounting-v2/reports/generate/route.js`
- Modify: `app/api/accounting-v2/reports/export/route.js`
- Modify: `hashReportRequest` to include groupBy/reportBasis/breakdown

- [ ] Pass `groupBy`, `reportBasis`/`accountingMethod`, `breakdown`, `currency`
- [ ] Commit

### Task 4: UI

**Files:**
- Create: `components/reports/ProfitLossFilters.jsx`
- Create: `components/reports/ProfitLossTable.jsx`
- Create: `components/reports/ProfitLossReportView.jsx`
- Modify: `app/reports-v2/page.js`

- [ ] Filters + Apply/Reset; table with period columns; More Actions export/print; Send disabled
- [ ] Swap main panel when INCOME_STATEMENT selected
- [ ] Commit

## Spec coverage

| Spec | Task |
| --- | --- |
| Period columns | 1–2 |
| Cash basis | 2 |
| Breakdown | 2 + 4 |
| Filters Apply | 4 |
| Export/Send | 4 |
| Other reports unchanged | 4 |
