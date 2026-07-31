# Permission Audit

## Current keys (`defaultRoleTemplates.js`)

- `rentals.view`, `rentals.create`, `rentals.update`, `rentals.delete`, `rentals.export`

Also accepted: `invoices.view` / `invoices.create` for some rental UI/API paths.

## Gaps vs target matrix

Missing: catalogue/rates/quotations/reservations/contracts/dispatch/returns/inspections/damage/deposits/billing/reconcile keys; all `hiring.*` inbound keys; auditor read-only set; SoD flags.

**Disposition:** `EXTEND` permission catalogue + enforce on every new command API.
