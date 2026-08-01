# Final review fix report

**Date:** 2026-08-01  
**Scope:** Important findings from `final-review.md` only. No commit.

## Important 1 — Edit pickers show grandfathered Inactive taxes

**Files:** `components/QuotationModal.js`, `components/InvoiceModal.js`

- Added `useMemo` → `pickerTaxTypes`: Active `taxTypes` unioned with line taxes on `formData.items` missing from Active (built via `lineTaxesOf`; extras marked `selectable: false` / `status: 'Inactive'`).
- Kept `taxTypes` = Active-only for create-new-tax / defaults.
- Taxes checkbox UI maps `pickerTaxTypes`: Active toggles normally; grandfathered rows show checked when on the line, allow uncheck only, muted `(inactive)` suffix.

## Important 2 — Docs drift

- Spec §4: create = strict Active-only; update = Active OR `allowInactiveIds` from existing item taxes.
- Spec §6: rejects **new** Inactive attachments; updates may preserve existing; edit pickers show grandfathered `(inactive)` rows.
- Plan Task 3 (+ coverage table): documents PUT `allowInactiveIds` grandfathering.

## Self-check

- Grep: both modals use `pickerTaxTypes` in the checkbox map.
- No schema changes.
- No commit.
