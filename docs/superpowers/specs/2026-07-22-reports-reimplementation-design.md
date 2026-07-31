# `/reports` Reimplementation — Design Spec

**Date:** 2026-07-22  
**Status:** **CLOSED** — Slices 1–4 implemented (see `docs/reports/FINAL_REPORT_REIMPLEMENTATION_REPORT.md`)  
**Approved forks:** **R1-B · R2-A · R3-C · R4-A**

---

## 1. Goal

Make financial reporting use **one** authority — posted Accounting V2 Journal Entry Lines — and make `/reports-v2` the **only** user-facing financial reporting hub. Legacy `/reports` becomes a redirect. Operational reports (Sales, Expenses, POS, Stock, Loss) show JE-based money with operational context for drill-down only.

---

## 2. Approved decisions

| Fork | Choice | Meaning |
|---|---|---|
| **R1-B** | V2 JE-only | All financial totals from `JournalEntry` / `JournalEntryLine` (`ACCOUNTING_V2`), via `/api/accounting-v2/reports/*` |
| **R2-A** | JE money + ops context | Sales/Expense/POS/Stock/Loss: amounts from JE; invoices/POS/movements for qty, refs, cashiers, items |
| **R3-C** | `/reports-v2` only | Sidebar, dashboard, deep links → `/reports-v2`. `/reports` and `/reports/financial` redirect there |
| **R4-A** | Posting-account rollup | Aggregate posting accounts only; parent direct activity = exception + warning; Owner Capital MK1,000,000 once |

---

## 3. Navigation (R3-C)

| Current | Target |
|---|---|
| Sidebar “Financial Reporting” → `/reports` | → `/reports-v2` |
| Dashboard / Footer links to `/reports` | → `/reports-v2` |
| `/reports` | Permanent redirect to `/reports-v2` (preserve `?report=` → V2 `?type=` map) |
| `/reports/financial` | Redirect to `/reports-v2` |
| Deep links e.g. `?report=stock-movement` | Map to V2 type or ops-context report id |

Legacy `app/reports/page.js` is **not** evolved as the primary UI; it may remain as a thin redirect page only.

---

## 4. Report catalogue mapping

| Legacy selector name | V2 `type` / extension | Notes |
|---|---|---|
| Profit & Loss Statement | `INCOME_STATEMENT` | Existing V2 |
| Profit Analysis | `PROFIT_ANALYSIS` (new) | Same P&L engine totals + margins/trends; no second P&L |
| Balance Sheet | `BALANCE_SHEET` | Existing |
| Cash Flow Statement | `CASH_FLOW` | Existing; **remove** multi-tenant ops cash path from any remaining callers |
| Tax Summary | `TAXES` | Existing; reconcile to tax control JE |
| Sales Report | `SALES` (new) | JE Revenue/Returns/Tax/COGS + invoice/sale context |
| Expense Report | `EXPENSES` (new) | JE Expense lines + expense doc context |
| Stock Movement Report | `STOCK_MOVEMENTS` (new) | Movement qty from stock domain; **value** from Inventory JE |
| Inventory Loss Report | `INVENTORY_LOSS` (new) | Loss Expense JE + write-off context |
| Daily POS Report | `DAILY_POS` (new) | POS-related JE + receipt/shift context |

Existing V2 extras (TB, Equity statement, AR/AP aging, Fixed Assets, Payroll, Loans, Budget vs Actual, GL) remain available in grouped nav on `/reports-v2`.

---

## 5. Architecture

```
User → /reports-v2
     → ReportRequest (server-resolved Business)
     → Report Definition Version + Account Mapping Version
     → Canonical Journal Source (ACCOUNTING_V2 posted only)
     → Aggregation + Formula + Validation (R4-A hierarchy)
     → Report Result (one envelope)
     → Screen | PDF | Excel | CSV | Drill-down
```

Reuse/extend:

- `lib/accountingV2/reporting/*` (financialReportService, reportContracts, drill-down, export, cache, runs)
- `lib/accountingV2/ledger/canonicalJournalSource.js`

Do **not** introduce a third reporting engine.

Operational context services attach non-financial columns and drill targets only; they must not redefine money totals.

---

## 6. R4-A hierarchy rules

1. Sum posting accounts only for report amounts.  
2. Header accounts roll up children; never add parent stored balance + children.  
3. Direct historical postings on a parent → treat as exceptional posting account; include once; emit validation warning.  
4. Executable test: MK1,000,000 Owner Capital posts once → BS shows MK1,000,000 once.  
5. Retained Earnings and Current Year Earnings each appear once per policy.

---

## 7. Report Result (mandatory fields for financial lines)

Every financial line / source account exposes:

- `accountCode`, `accountName` (or expandable `sourceAccounts[]`)
- debit / credit / net  
- `journalLineCount`  
- `drillDownToken` → JE lines → `sourceModule` / `sourceId`  
- definition + mapping version + posting watermark  
- validation status / warnings / blockers  

Screen and exports consume the **same** Report Result.

---

## 8. Slice plan

### Slice 1 — Cutover to V2-only (R3-C + R1-B)

- Redirect `/reports` → `/reports-v2` with query map  
- Update Sidebar, dashboard, footer, known deep links  
- Document legacy catalog → V2 type map  
- Smoke: nav lands on V2; generate INCOME_STATEMENT / BALANCE_SHEET / CASH_FLOW

### Slice 2 — Hierarchy invariants (R4-A)

- Strengthen aggregation to posting-only  
- Capital once + RE/CYE once tests  
- Unmapped material account warnings on V2 reconciliation

### Slice 3 — New JE-first ops reports (R2-A)

- Add `PROFIT_ANALYSIS`, `SALES`, `EXPENSES`, `STOCK_MOVEMENTS`, `INVENTORY_LOSS`, `DAILY_POS` to V2 contracts + generators + UI groups  
- Wire drill-down + export through same envelope  
- Cross-reconcile to INCOME_STATEMENT / BALANCE_SHEET / INVENTORY / TAXES

### Slice 4 — UX / export / hardening

- Selector shows current report name (no stuck “Jump to report…” on V2)  
- Shared filters, export parity tests, permissions, FINAL report  
- Quarantine/retire dangerous legacy ops cash-flow and stub export routes from product paths

---

## 9. Non-goals (this track)

- Cosmetic-only redesign of legacy page  
- Mutating posted journals to force totals  
- Ops-led financial totals (R2-B)  
- Claiming zero defects before Slice 3–4 evidence  
- Full 50-file docs tree in Slice 1 (core docs already in `docs/reports/`; expand with implementation)

---

## 10. Success criteria (honest)

| Slice | Done when |
|---|---|
| 1 | Users cannot use legacy `/reports` UI; all nav → V2 JE engine |
| 2 | Capital/hierarchy invariants green |
| 3 | All 10 legacy selector capabilities exist on V2 with JE money |
| 4 | Exports match screen; reconciliation matrix documented with evidence |

---

## Spec self-review

- [x] Forks R1-B / R2-A / R3-C / R4-A explicit (R3-C = V2-only, not hybrid shell)  
- [x] No third engine  
- [x] Ops context vs money authority clear  
- [x] Slice-bounded; full master prompt not claimed in Slice 1  
- [x] Aligns with existing V2 reporting APIs  
