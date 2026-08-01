# Task 4 Report: Tax Codes Activate / Deactivate UX

## Status

**DONE**

## Commits

None (per instructions).

## Summary

Added activate/deactivate UX on `/tax-management/tax-codes` (`app/tax-types/page.js`). Card Actions now show **Deactivate** (Active → confirm about quotations/invoices/POS) or **Activate** (Inactive). `toggleTaxStatus` PUTs `{ status }` to `/api/tax-types/:id`, refreshes the list on success, and surfaces errors via the existing error banner.

## Files Modified

| File | Change |
|------|--------|
| `app/tax-types/page.js` | Added `toggleTaxStatus`; Activate/Deactivate buttons in card action row (gated by `canUpdateTax`) |

## Behavior

1. Active → confirm: “This tax will no longer appear on quotations, invoices, or POS.” → PUT `{ status: "Inactive" }`
2. Inactive → PUT `{ status: "Active" }` (no confirm)
3. Success → success banner + `loadData()`; failure → error banner

## Manual check (Step 4)

Not run in this session. After deploy/local: Deactivate a tax → confirm it disappears from Invoice modal tax picker after reload; Activate → reappear.

## Concerns

- Page uses **cards** (not a table); actions live in each card footer — matches existing UI, not a literal “Actions column”.
- Overwrote prior unrelated `task-4-report.md` content (Phase 17 Wave 4 CS onboarding) at this path as instructed.
