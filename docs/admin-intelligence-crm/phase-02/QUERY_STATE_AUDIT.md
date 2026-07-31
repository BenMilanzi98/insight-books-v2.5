# Query State Audit

## Current

Filters often local React state; URL sync inconsistent.

## Phase 2 foundation

`lib/admin/queryState.js`:

- Parse/serialize filter + date-range + pagination to URL search params
- Explicit scope parameter when tenant-scoped views need `tenantId`
- Reject silent unscoped fallback when `requiredScope` set

Compose with `AdminFilterBar` + `AdminDateRangePicker`.
