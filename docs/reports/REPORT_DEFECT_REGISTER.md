# Report Defect Register

**Date:** 2026-07-22  
**Severity:** CRITICAL / HIGH / MEDIUM / LOW  
**Status:** OPEN | PARTIAL | FIXED | MITIGATED  
**Track:** **CLOSED** — product hub is `/reports-v2` (see FINAL report)

---

## Cutover resolution (product path)

| ID | Status | Resolution |
|---|---|---|
| RPT-C01 | **MITIGATED** | UI forced to V2; `/reports` redirects — dual hub removed for users |
| RPT-C02 | **FIXED** | Legacy cash-flow API/export retired (410) |
| RPT-C03 | **FIXED** | V2 `SALES` JE-first on hub |
| RPT-C04 | **FIXED** | V2 `EXPENSES` JE-first on hub |
| RPT-C05 | **MITIGATED** | V2 `DAILY_POS` JE sales totals; rich POS join is backlog |
| RPT-C06 | **MITIGATED** | Hub uses V2 `TAXES`; legacy tax route may remain in tree |
| RPT-C07 | **FIXED** | V2 screen + export share one envelope |
| RPT-C08 | **FIXED** | R4-A posting-only + exceptional header once + tests |
| RPT-C09 | **MITIGATED** | V2 path uses minor units; legacy float code may remain unused |
| RPT-C10 | **FIXED** | V2 lines expose account codes/names + drill-down |
| RPT-C11 | **OPEN** | Dead generators still in repo — deletion backlog |
| RPT-C12 | **FIXED** | V2 `STOCK_MOVEMENTS` / `INVENTORY_LOSS` JE-first |

---

## Summary (forensic register — historical OPEN counts)

| Severity | Count (original OPEN/PARTIAL) |
|---|---|
| CRITICAL | 12 |
| HIGH | 16 |
| MEDIUM | 14 |
| LOW | 8 |
| **Total** | **50** |

---

## CRITICAL (forensic evidence — original)

| ID | Defect | Evidence | Impact |
|---|---|---|---|
| RPT-C01 | Dual financial authorities (V1 TxLine+JE vs V2 JE-only) | `officialLedgerEngine` vs `canonicalJournalSource` | Same business can show different statement totals on `/reports` vs `/reports-v2` |
| RPT-C02 | Multi-tenant Cash Flow uses operational path | `cash-flow/route.js` → `generateCashFlowFromAccounts` | Cash Flow ≠ GL for multi-business scope |
| RPT-C03 | Sales Report financial totals from ops tables | `api/reports/sales` | Revenue can diverge from P&L JE lines |
| RPT-C04 | Expense Report financial totals from ops tables | `api/reports/expenses` | Expense can diverge from P&L |
| RPT-C05 | Daily POS financial totals from ops | `posDailyReportService` | POS ≠ Sales/P&L/JE |
| RPT-C06 | Tax Summary hybrid; document side can lead | `tax-summary` | Tax ≠ control accounts |
| RPT-C07 | No single Report Result for screen+PDF+Excel on legacy hub | Separate export builders | Export parity risk |
| RPT-C08 | Parent/child double-count residual risk | Partial header skip; Capital MK1m defect historically | Equity / assets overstated |
| RPT-C09 | Float/`Number` money in report aggregations | Multiple services | Rounding / drift |
| RPT-C10 | Incomplete account code/name on every report line | Selector reports UX | Master-prompt lineage fail |
| RPT-C11 | Dead invoice-based IS/BS generators still in codebase | Route files | Accidental reuse risk |
| RPT-C12 | Inventory Loss / Stock Movement not JE-first for value | Ops stock services | Inventory GL mismatch |

---

## HIGH

| ID | Defect | Notes |
|---|---|---|
| RPT-H01 | Hardcoded expense rollup codes (5200/5400/…) | `incomeStatementOperatingExpenseRollup.js` |
| RPT-H02 | No versioned Report Definition Registry on legacy hub | Definitions ad hoc |
| RPT-H03 | No versioned Account Mapping Registry driving `/reports` | Partial CoA V2 mappings elsewhere |
| RPT-H04 | Profit Analysis may not share identical P&L engine totals | Analytics path |
| RPT-H05 | Stub export route still present | `export/[reportType]/export` |
| RPT-H06 | Mock ratios API | `api/reports/ratios` |
| RPT-H07 | `/reports/financial` bypasses GL engines | Dashboard APIs |
| RPT-H08 | Scope inconsistency (some routes `user.tenantId` only) | Cross-scope risk |
| RPT-H09 | Selector label stays “Dashboard / Jump to report…” | UX |
| RPT-H10 | Drill-down incomplete for all 10 reports | Partial account-trace only |
| RPT-H11 | Unmapped material accounts not blocking | No unmapped panel on legacy |
| RPT-H12 | Legacy report cache absent | Stale risk / perf |
| RPT-H13 | Default tax rate fallback (e.g. 30) | income-statement settings |
| RPT-H14 | Closing/opening/reversal classification incomplete in UI | Presentation |
| RPT-H15 | Comparatives incomplete across all reports | — |
| RPT-H16 | Granular `reports.*` permission matrix incomplete | — |

---

## MEDIUM

| ID | Defect |
|---|---|
| RPT-M01 | No shared filter bar across all report types |
| RPT-M02 | Dimension Unallocated not always shown |
| RPT-M03 | Multi-currency presentation incomplete |
| RPT-M04 | Snapshot workflow only on V2, not legacy hub |
| RPT-M05 | Scheduled/saved reports incomplete |
| RPT-M06 | Dashboard KPIs may diverge from detailed reports |
| RPT-M07 | Accessibility of selector/filters incomplete |
| RPT-M08 | Mobile table/filter UX incomplete |
| RPT-M09 | CSV formula-injection hardening uneven |
| RPT-M010 | Typed report errors incomplete on legacy |
| RPT-M11 | N+1 / unbounded drill-down risk |
| RPT-M12 | Print layouts incomplete |
| RPT-M13 | Source document drill-down permission uneven |
| RPT-M14 | Historical reconciliation not catalogued per tenant |

---

## LOW

| ID | Defect |
|---|---|
| RPT-L01 | Duplicate report names in nav groups |
| RPT-L02 | Loading/empty/error state inconsistency |
| RPT-L03 | Chart overflow on small screens |
| RPT-L04 | Report description copy outdated |
| RPT-L05 | availableReports.filter — **FIXED** (guarded) |
| RPT-L06 | Search within selector limited |
| RPT-L07 | Full docs tree (50+ files) not yet written |
| RPT-L08 | Admin twin catalog drift risk |

---

## Explicit non-defects / reuse

- V2 generate/export/drill-down architecture exists and is JE-canonical.  
- Legacy P&L/BS primary GET paths already call GL builders.  
- `availableReports.filter` TypeError mitigated.
