# Final review re-review — Important fixes only

**Date:** 2026-08-01 · **Mode:** read-only (verdict write only)

## Important #1 — Edit pickers / grandfathered Inactive
**Resolved: Yes**  
Both `QuotationModal.js` and `InvoiceModal.js` define `pickerTaxTypes` (Active `taxTypes` ∪ line taxes missing from Active, `selectable: false` / `status: 'Inactive'`). Checkbox maps `pickerTaxTypes`: `if (!selectable && !checked) return` (uncheck-only); `(inactive)` label when `!selectable`; Active toggles normally.

## Important #2 — Spec/plan create vs PUT
**Resolved: Yes**  
Spec §4: create strict Active-only; update Active **or** `allowInactiveIds`. §6 acceptance matches. Plan Task 3 (+ coverage table) documents PUT grandfathering.

## New Critical/Important regressions?
**None** observed in the Important-fix surface. Prior Minors (doc-scoped allow-list, etc.) unchanged / out of scope.

## Ready to merge?
**Yes**
