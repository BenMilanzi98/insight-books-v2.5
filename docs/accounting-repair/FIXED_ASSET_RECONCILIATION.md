# Fixed Asset Reconciliation

Comparison set: Fixed Asset Register, acquisition journals, depreciation
journals, accumulated depreciation, disposals, gain/loss on disposal, asset GL
accounts.

| Pattern | Repair |
|---|---|
| Registered asset without acquisition journal | `MISSING_JOURNAL_REPAIR` from purchase evidence |
| Acquisition journal without register entry | Orphan procedure / register correction (operational fix) |
| Duplicate acquisition | `DUPLICATE_EFFECT_REPAIR` |
| Depreciation posted twice for one period | `DUPLICATE_EFFECT_REPAIR` |
| Depreciation missing | `MISSING_JOURNAL_REPAIR` computed under the approved policy |
| Wrong useful-life treatment | Requires an approved accounting-policy decision BEFORE any recalculation; then `AMOUNT_ADJUSTMENT_REPAIR` for the proven difference |
| Disposal without journal | `MISSING_JOURNAL_REPAIR` (remove cost, remove accumulated depreciation, recognize gain/loss) |
| Cost or accumulated depreciation not removed on disposal | `AMOUNT_ADJUSTMENT_REPAIR` for the proven residue |
| Gain/loss computed incorrectly | `AMOUNT_ADJUSTMENT_REPAIR` for the difference |
| Asset purchase expensed | `RECLASSIFICATION_REPAIR` (Dr Asset / Cr Expense) |
| Asset dimension missing | Dimension repair |
| `ASSET_CONTROL_DIFFERENCE` residual | Exception |

Historical depreciation is never recalculated without approved accounting
policy and evidence — the policy decision is an approval-matrix HIGH item with
finance sign-off recorded on the anomaly.
