# POS and Invoice Event Comparison

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

| Dimension | POS | Invoice |
|---|---|---|
| Finalization | completed sale | non-Draft issue |
| Accounting | INVENTORY_SOLD / Sale | INVOICE_POSTED / Invoice |
| Inventory | type sale | type invoice |
| Payment | Usually at sale | Often later |
| Offline | Browser queue | Typically online |
| Current EIS hook | post-commit | post-commit |

## Recommendation

Canonical internal event: **`SALE_FISCALIZATION_ELIGIBLE`** emitted by adapters from:
- `POS_SALE_FINALIZED` (status completed)
- `SALES_INVOICE_ISSUED` (non-Draft after posting)

Exclude: drafts, payments, pure reprints.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
