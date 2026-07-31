# Accounting Integration Audit

## Authoritative actuals path

| Layer | File | Use |
|-------|------|-----|
| Canonical source | `lib/accountingV2/ledger/canonicalJournalSource.js` | Posted V2 journals only |
| Ledger query | `lib/accountingV2/ledger/ledgerQueryService.js` | Period movement / hierarchy |
| BvA foundation | `lib/accountingV2/reporting/subledgerReportsService.js` → `generateBudgetVsActual` | Sign + envelope pattern |
| Drill-down | `lib/accountingV2/reporting/reportDrillDownService.js` | Account → lines → journal |

## Sign policy (reuse)

- Ledger core: `debitMinor - creditMinor`
- P&L natural-positive: REVENUE / OTHER_INCOME × −1
- Expense / CoS: debit − credit (sign +1 on period movement)

## Do not use for greenfield actuals

- `lib/bfActualsEngine.js`
- Stored `BudgetItem.actualAmount`
- Sales / Expense / Invoice operational totals as financial actuals

## Dimensions

- Branch: `JournalEntry.branchId` (first-class)
- Department / project / cost centre: `JournalEntryLine.dimensions` JSON (`dimensionPolicy.js`)
- Greenfield budgets store the same dims on lines; actuals filter must match
