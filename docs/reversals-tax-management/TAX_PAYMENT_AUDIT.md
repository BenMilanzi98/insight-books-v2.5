# Tax Payment Audit

## Flow
UI TaxSettlementModal / tax pages → POST /api/tax/settle → Expense+Payment → postTaxPayment → postTaxSettlementAccounting (V2).

## Gaps
- tax.settle permission defined but unused on route/UI
- taxPeriod string in audit only (no TaxPeriod entity)
- No partial allocation register / refund / credit apply APIs

## Classification
EXTEND settle authz + period. Wave 4 for payments/refunds/credits workflows.
