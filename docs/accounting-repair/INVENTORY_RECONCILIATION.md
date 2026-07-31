# Inventory Reconciliation

Quantity and financial value reconcile **separately**: stock-movement history
supports quantities; the Inventory control account and COGS accounts must be
supported by journals valued under the approved method.

Comparison set: inventory quantities, valuation, stock movements, purchase
receipts, Cost of Sales, stock adjustments, opening stock, Inventory GL
account, COGS accounts.

| Pattern | Anomaly / repair |
|---|---|
| Opening stock counted in a stored value AND an opening journal | `OPENING_BALANCE_DUPLICATION` → duplicate-effect reversal or report fix per mechanism |
| Inventory purchase expensed instead of capitalized | `RECLASSIFICATION_REPAIR` (Dr Inventory / Cr the expense account) |
| COGS posted more than once for one sale | `DUPLICATE_EFFECT_REPAIR` |
| Inventory sale without COGS | `MISSING_JOURNAL_REPAIR` valued from approved evidence (cost layers/valuation records) |
| Stock adjustment without journal | `MISSING_JOURNAL_REPAIR` from the adjustment record |
| Journal without stock movement | Orphan procedure |
| Direct inventory balance updates | `DIRECT_ACCOUNT_BALANCE_UPDATE` → stored-balance treatment |
| Negative stock producing invalid cost | Investigation + `AMOUNT_ADJUSTMENT_REPAIR` for the proven costing error only |
| Cross-location / cross-business | Dimension / cross-business repair |
| `INVENTORY_CONTROL_DIFFERENCE` residual | Exception with disclosure |

Inventory values are never invented: a valuation without approved evidence
cannot pass the confidence gate. Wrong-valuation-method corrections require an
approved accounting-policy decision before any journal.
