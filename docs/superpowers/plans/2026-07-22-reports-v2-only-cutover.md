# Reports V2-Only Cutover & JE-First Ops Reports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Status:** **CLOSED** 2026-07-22 — see `docs/reports/FINAL_REPORT_REIMPLEMENTATION_REPORT.md`.

**Goal:** Force all financial reporting UX through `/reports-v2` (Accounting V2 JE-only), then add JE-first Sales/Expense/Stock/Loss/POS/Profit Analysis with hierarchy invariants.

**Architecture:** Redirect legacy `/reports` → `/reports-v2`; extend `lib/accountingV2/reporting/*` for new types; ops tables are context-only for money.

**Tech Stack:** Next.js App Router, existing Accounting V2 reporting engine, Vitest, Prisma.

**Approved forks:** R1-B · R2-A · R3-C · R4-A  
**Spec:** `docs/superpowers/specs/2026-07-22-reports-reimplementation-design.md`

## Global Constraints

- Financial totals only from posted `ACCOUNTING_V2` Journal Entry Lines.
- Exact decimal / minor-unit money (no float authority).
- Business scope from session only.
- One Report Result for screen and exports.
- Posting accounts only for rollups (R4-A); Capital once.
- Do not mutate posted journals from reports.

---

## Slice 1 — R3-C cutover (first coding slice)

### Task 1: Redirect `/reports` → `/reports-v2`

**Files:** Replace `app/reports/page.js` with redirect; `app/reports/financial/page.js` redirect.

- [x] Map query `?report=profit-loss` → `?type=INCOME_STATEMENT` (full map in constants)
- [x] Client or server redirect (prefer `next/navigation` redirect / `permanentRedirect` where App Router allows)
- [x] Manual: `/reports` lands on `/reports-v2`

### Task 2: Nav deep-link updates

**Files:** `components/Sidebar/Sidebar.js`, `app/dashboard/page.js`, `components/Footer.js`, other `href="/reports"` hits

- [x] Point Financial Reporting to `/reports-v2`
- [x] Update stock/dashboard deep links to V2 query types
- [x] Keep permission `reports.view`

### Task 3: Legacy → V2 type map module + tests

**Files:** `lib/accountingV2/reporting/legacyReportRedirectMap.js`, `test/accountingV2/legacyReportRedirectMap.test.js`

- [x] Bidirectional map for 10 legacy ids
- [x] Unknown → `/reports-v2` without type
- [x] Vitest pass (6/6)

### Task 4: Docs

- [x] Update `docs/reports/README.md` status
- [x] Mark forks approved in `REPORT_REIMPLEMENTATION_TASKS.md`

---

## Slice 2 — R4-A hierarchy (after Slice 1)

- [x] Posting-only aggregation audit in V2 statement builders
- [x] Exception warning for parent direct postings
- [x] Tests: capital MK1,000,000 once; no parent+child double count

---

## Slice 3 — R2-A new report types

- [x] Extend `reportContracts` enums + definitions
- [x] Generators: PROFIT_ANALYSIS, SALES, EXPENSES, STOCK_MOVEMENTS, INVENTORY_LOSS, DAILY_POS
- [x] UI categories on `app/reports-v2/page.js`
- [x] Drill-down + export via existing envelope
- [x] Reconciliation tests vs INCOME_STATEMENT / INVENTORY / TAXES

---

## Slice 4 — Hardening

- [x] Kill product paths to multi-tenant ops cash-flow / stub export (HTTP 410)
- [x] Export parity: V2 envelope path remains sole authority for new types; legacy multi-tenant CF export 410
- [x] FINAL_REPORT_REIMPLEMENTATION_REPORT.md (honest)

---

## Verification (Slice 1)

```bash
npx vitest run test/accountingV2/legacyReportRedirectMap.test.js
```

Manual: Sidebar → Financial Reporting → `/reports-v2`; `/reports?report=balance-sheet` → V2 BALANCE_SHEET.
