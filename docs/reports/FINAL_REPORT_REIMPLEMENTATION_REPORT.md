# Final Report — `/reports` Reimplementation (V2-only cutover)

**Date:** 2026-07-22  
**Approved forks:** R1-B · R2-A · R3-C · R4-A  
**Status:** **CLOSED** — product cutover complete for the approved scope  

---

## 1. Executive summary

InsightBooks financial reporting UX is forced through **`/reports-v2`**. Money authority is posted Accounting V2 journal lines only. Legacy `/reports` redirects; multi-tenant and single-tenant legacy cash-flow APIs return **410 Gone**. JE-first Sales / Expenses / Stock / Loss / POS / Profit Analysis are available on the V2 hub with ops context only for non-money columns.

This closes the approved cutover. It does **not** claim every historical `/api/reports/*` file has been deleted from the repo, or that every master-prompt aesthetic/a11y item is finished.

---

## 2. What shipped

| Slice | Result |
|---|---|
| **1 — R3-C** | Redirect map, `/reports` + `/reports/financial` redirects, nav deep links, `/reports-v2` `?type=` sync |
| **2 — R4-A** | Posting-only amounts, exceptional headers once (`REP-041`), capital/RE/CYE once, hierarchy children-only rollup |
| **3 — R2-A** | `PROFIT_ANALYSIS`, `SALES`, `EXPENSES`, `STOCK_MOVEMENTS`, `INVENTORY_LOSS`, `DAILY_POS` |
| **4 — Harden** | Legacy cash-flow GET + export **410**; `/api/reports/available` returns V2 catalogue + hub pointers |

---

## 3. Canonical surfaces

| Surface | Path |
|---|---|
| UI hub | `/reports-v2` |
| Generate | `POST /api/accounting-v2/reports/generate` |
| Export | `/api/accounting-v2/reports/export` |
| Drill-down | `/api/accounting-v2/reports/drill-down` |
| Legacy UI | `/reports` → redirect via `legacyReportRedirectMap` |
| Legacy cash-flow | `/api/reports/cash-flow` → **410** |

---

## 4. Confirmations (approved scope)

| Rule | Status |
|---|---|
| Financial totals from ACCOUNTING_V2 JE only (R1-B) on product hub | Yes |
| Ops reports: JE money + context only (R2-A) | Yes |
| Sole hub `/reports-v2` (R3-C) | Yes |
| Posting-only rollup; capital once (R4-A) | Yes |
| Multi-tenant ops cash-flow killed | Yes (410) |
| Legacy cash-flow API/export retired | Yes (410) |
| Screen + export share V2 envelope for V2 types | Yes |
| No mutation of posted journals from reports | Yes |

---

## 5. Verification

```bash
npx vitest run test/accountingV2/legacyReportRedirectMap.test.js \
  test/accountingV2.reports.test.js \
  test/accountingV2.ledger.test.js \
  test/accountingV2/operationalReports.test.js
```

**Result (close-out):** 109 passed.

Manual: Sidebar → Financial Reporting → `/reports-v2`; `/reports?report=balance-sheet` → V2 `BALANCE_SHEET`.

---

## 6. Backlog (out of closed scope)

1. Delete unused legacy `/api/reports/*` generators after callers are confirmed gone.  
2. Richer DAILY_POS receipt/shift ops join (money already JE).  
3. Thicker CSV column packs for ops context on Slice 3 types.  
4. Remove dead invoice-based IS/BS generators still sitting in old route files.  
5. Full a11y / Completion Pack PDF packaging.

---

## 7. Readiness conclusion

| Use | Ready? |
|---|---|
| Product financial reporting via `/reports-v2` | **Yes** |
| Declaring every legacy API file deleted / zero historical defects | **No** |
| Declaring master-prompt aesthetic pack 100% complete | **No** |

**Track status: CLOSED.** Further work is backlog, not open cutover.
