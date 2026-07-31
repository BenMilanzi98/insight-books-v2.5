# Report Inventory

## V2 reports (authoritative target)

Namespace: `/api/accounting-v2/reports/*` (under accounting-v2).

Services: `financialReportService`, `trialBalanceService`, `financialStatementService`, export helpers.

UI: `/reports-v2`.

## Legacy reports (live — risk)

Namespace: `/api/reports/*` — **34** handlers including:

- trial-balance → `lib/trialBalanceReport.js`
- balance-sheet → `lib/balanceSheetService.js`
- income-statement → `lib/incomeStatementService.js`
- cash-flow → `lib/cashFlowService.js`
- sales / expenses / inventory / POS daily / etc.

## Required financial reports — status

| Report | V2 path | Legacy path | Status |
| --- | --- | --- | --- |
| Chart of Accounts | coa-v2 + accounts APIs | accounts UI | COMPLETE_REQUIRES_TESTING |
| General Ledger | accounting-v2/ledger | general-ledger | DUPLICATED |
| Trial Balance | accounting-v2/reports | reports/trial-balance | DUPLICATED |
| Balance Sheet | accounting-v2/reports | reports/balance-sheet | DUPLICATED |
| Profit and Loss | accounting-v2/reports | reports/income-statement | DUPLICATED |
| Cash Flow | accounting-v2/reports | reports/cash-flow | DUPLICATED |
| Equity changes | equity-management + reports | capital-account | PARTIALLY_IMPLEMENTED |
| AR/AP aging | mixed | reports/* | PARTIALLY_IMPLEMENTED |
| Bank / cash book | bank-reconciliation | legacy bank | PARTIALLY_IMPLEMENTED |
| Tax / VAT / PAYE | tax + payroll reports | reports/* | PARTIALLY_IMPLEMENTED |
| Inventory valuation | stock + COGS | reports/* | PARTIALLY_IMPLEMENTED |
| MRA EIS | mra-eis APIs | n/a | CONTROLS_READY_PRODUCTION_BLOCKED |

## Rule

Reports must show account code + name, drill to ledger lines, and export totals equal to screen. V2 exporters enforce this in tests; legacy paths are not certified equivalent.
