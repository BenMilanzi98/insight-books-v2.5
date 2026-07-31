# Financial Report Lineage Audit

Rule audited: financial statements must read **only** from posted General Ledger lines.
Verdicts: **GL-pure** (posted `TransactionLine` + non-mirrored posted `JournalEntryLine`) /
**Mixed** / **Operational** / **Stored-balance**. Machine-readable version:
`artifacts/accounting-audit/report-lineage.json`.

## Statement-grade reports

| Report | Route/Service | Source | Verdict | Findings |
|---|---|---|---|---|
| Income Statement | `app/api/reports/income-statement` → `buildProfitAndLossFromGl` | Posted dual-ledger GL, merge-survivor rollup, group headers skipped | **GL-pure** | Legacy `incomeStatementService` (Payment+Sale revenue, Expense opex) still live behind other endpoints |
| Balance Sheet | `app/api/reports/balance-sheet` → official ledger as-of | Posted dual-ledger GL | **GL-pure** | Legacy `generateBalanceSheet`/`balanceSheetService` (AccountBalance cash + Invoice AR + Expense AP + `Account.balance` fallback) still reachable via exports/ratios |
| Trial Balance | `app/api/reports/trial-balance` → `buildTrialBalance` | Posted dual-ledger GL | **GL-pure** | **Does not skip group-header accounts** (P&L/BS do) → parent+child double-count risk (TB-003) |
| Cash Flow (single tenant) | `getCashFlowReport` + `classifyCashFlowFromGl` | GL BS endpoints + `TransactionLine` classifier | **GL-pure (narrow)** | Classifier ignores `JournalEntryLine` and drops `isReversal:true` rows |
| Cash Flow (multi-tenant) | `generateCashFlowFromAccounts` (`cashFlowService.js`) | Payments/Expenses + legacy BS (stored balances) | **Mixed/Operational** | **CRITICAL**: statement-grade output from operational data |
| Statement of Changes in Equity | not implemented | — | — | scope gap |

## Sub-ledgers, tax, analytics

| Report | Source | Verdict | Findings |
|---|---|---|---|
| AR aging (`arAgingService`) | `Invoice`+`Payment` operational; GL control account used only as advisory `isReconciled` check with `contains:'Receivable'` name match | **Operational** | **CRITICAL** class: aging ≠ control account (proven 15,000 divergence); route currently retired (410) but dashboards use the service |
| AP aging (`apAgingService`) | `Expense`+`SupplierBill`; supplier bills forced into "current" bucket | **Operational** | **CRITICAL** class |
| Tax/VAT summary | Operational documents primary, GL when tax activity exists | **Mixed** | dual-basis totals can disagree |
| Sales report | `Sale`+`Invoice` primary; GL reconciliation sidecar only | **Operational** | `fromGeneralLedger` flag is metadata only |
| Expense report | Expense register + GL COGS | **Mixed** | |
| Financial ratios | single-tenant: legacy IS+BS services; multi-tenant: GL | **Mixed** | **CRITICAL**: response labels single-tenant output `source:'general_ledger'` — misleading |
| Financial analytics / summary / product-profit / historical | Invoice/Sale/Expense/SupplierBill | **Operational** | |
| Reports generate (`[id]/generate`) | Operational + **hardcoded equity constants** | **Operational** | legacy generator with fake capital stock values |
| Report exports | Mix; BS PDF can call legacy `generateBalanceSheet` | **Mixed** | export output can diverge from live GET |
| GL reconciliation / integrity / account drilldown | Official GL engine | **GL-pure** | audit tooling, correct |
| Payroll summary (HR) | `Payroll` table | **Operational** | HR report; negates `Reversed` rows |
| POS daily / stock movement / inventory losses | Sale/Payment/InventoryTransaction | **Operational** | operational registers by design |

## Dashboards

| Endpoint | Source | Verdict | Findings |
|---|---|---|---|
| metrics / income-expenses / daily-performance | GL P&L preferred, **operational fallback** (Payment+Sale revenue, Expense opex); AR always from Invoice | **Mixed** | **CRITICAL** when GL inactive: silently switches basis |
| financial-position | GL KPIs + operational/`AccountBalance` reconciliation load | **Mixed** | |
| receivables / payables | Invoice / Expense | **Operational** | |
| revenue-by-category | `Sale` | **Operational** | |
| expenses-breakdown | Expense + GL COGS | **Mixed** | |
| cash-flow | Payment + Invoice/Expense + **stored `AccountBalance`** | **Operational/Stored-balance** | **CRITICAL** |
| transactions / recent-invoices / upcoming-payments | operational | Operational | activity feeds, acceptable |

## Chart of Accounts balance display

Primary: journal-derived posted GL (`loadCoaBulkGlAggregates`, both ledgers, survivor rollup,
drafts counted separately). Fallbacks when an account has no posted activity: AR open-invoice
subledger, physical inventory valuation, then **legacy stored `Account.balance`**
(`balanceSource: legacy_account_balance`). This fallback chain is precisely where stored-only
figures (legacy header journals, backfilled balances) surface in the CoA while Journal Entries
show nothing — consistent with the unsupported-liability and capital-discrepancy traces.

## Reports bypassing the GL (critical classification per mandate)

1. Multi-tenant cash flow (statement-grade).
2. AR/AP aging services (subledger reports feeding dashboards).
3. Dashboard metrics fallback basis + dashboard cash-flow (stored balances).
4. Financial ratios single-tenant (with misleading GL label).
5. Legacy IS/BS services still reachable via summary/analytics/exports.
6. Reports generate endpoint (hardcoded equity constants).
