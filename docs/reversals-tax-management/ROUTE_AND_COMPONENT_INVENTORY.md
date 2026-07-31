# Route and Component Inventory

## Pages
| Route | File | Class |
|-------|------|-------|
| /transactions/reversals | app/transactions/reversals/page.js | EXTEND |
| /tax-types | app/tax-types/page.js | MIGRATE content → tax-codes |
| /tax-accounts | app/tax-accounts/page.js | MIGRATE → accounts |
| /tax-accounts/[id] | app/tax-accounts/[id]/page.js | MIGRATE |
| /tax-management | app/tax-management/page.js | EXTEND hub shell |
| /tax | app/tax/page.js | MIGRATE/redirect |
| /tax-rules | app/tax-rules/page.js | REIMPLEMENT later |

## Reversal components
- components/TransactionReversal/* (Modal, Button, StatusBadge)
- hooks/useTransactionReversal.js

## Tax components
- components/TaxSettlementModal.js
- components/tax/TaxSettings, TaxSummaryChart, TaxCollectedTable, TaxPaidTable

## Key libs
- lib/transactionReversalService.js
- lib/accountingV2/application/journalReversalService.js
- lib/accountingV2/application/reverseSourceJournals.js
- lib/taxCalculationService.js
- lib/taxAccountsInitialization.js (2041/2045)
