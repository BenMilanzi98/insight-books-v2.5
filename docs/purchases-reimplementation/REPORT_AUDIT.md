# Report Audit

## Existing

| Surface | Finding | Classification |
|---------|---------|----------------|
| `/suppliers/reports` | Legacy supplier reports page | `CONSOLIDATE` |
| Export routes under `/api/purchases/*/export` | CSV/XLSX style exports | `EXTEND`; often `DISCONNECTED` from UI |
| Accounting V2 reports | GL/TB — not purchases-specific | `REUSE` for drill-down target |
| Purchases dashboard | Missing | `INCOMPLETE` |
| GRNI aging / AP aging purchases centre | Missing / may exist under general AP reports — not verified as P2P-linked | `INCOMPLETE` |

## Required report families (prompt)

Supplier, Order, Receipt, Bill, Payment, Accounting/Inventory reconciliation — **mostly unimplemented** as a coherent Purchases Reporting module.

## Labeling risk

Any report that sums PO totals as “Purchases” or “Spend” is **`INCORRECT_ACCOUNTING`** presentation — commitments ≠ expenses.

## Disposition

Build report queries from journals + stock movements + source docs after GRNI cutover; do not ship dashboard cards before posting fix.
