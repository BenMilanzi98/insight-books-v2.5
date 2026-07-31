# Income Statement Implementation

`generateIncomeStatement` in
`lib/accountingV2/reporting/financialStatementService.js`, definition
`IS-STANDARD` 1.0.0.

## Structure

Revenue → Cost of Sales → **Gross Profit** → Operating Expenses (excluding
depreciation, finance costs and tax by explicit exclusion rules) → **EBITDA**
→ Depreciation and Amortization → **Operating Profit** → Other Income / Other
Expenses → Finance Costs → **Profit Before Tax** → Tax Expense → **Net
Profit / (Loss)**. Gross and net margin percentages are included in totals.

## Calculation rules

- **Period activity only** — line amounts are signed period movements from the
  GL summary; prior-period figures appear only in comparative columns.
- Scope predicate: only P&L categories (REVENUE, OTHER_INCOME, COST_OF_SALES,
  EXPENSE, OTHER_EXPENSE) participate. Capital contributions, loan proceeds
  and owner drawings are structurally excluded (equity/liability categories) —
  tested: those account ids appear on no Income Statement line.
- Calculated lines use controlled formulas; EBITDA and Operating Profit
  definitions are encoded in the versioned definition (the calculation
  definition version is stored with every run/snapshot).
- Cost of Sales derives from posted COST_OF_SALES accounts — never from stock
  quantities inside the statement service.
- REP-002 control: the statement's net profit is compared with the direct P&L
  computation over the same canonical rows
  (`directNetProfit + pnlUnmappedSigned`); any difference is a blocking
  equation failure. Unmapped P&L activity is disclosed via REP-036 and blocks
  VERIFIED.
- Net Profit reconciles to Balance Sheet Current Year Earnings for the
  financial-year window (checked by `runReportReconciliation`).

## Views

Monthly, quarterly and annual windows are just request date ranges;
comparatives must be full equivalent periods (enforced at the contract).
Branch filtering flows to the GL query; finer dimensions via drill-down.
Every populated group line lists source account codes/names and supports
account-level expansion and journal drill-down (basis PERIOD).

Expected figures for the canonical test fixture: revenue 100,000; gross profit
60,000; EBITDA 30,000; operating profit 25,000; PBT 23,000; net profit 20,000
— all asserted in `test/accountingV2.reports.test.js`.
