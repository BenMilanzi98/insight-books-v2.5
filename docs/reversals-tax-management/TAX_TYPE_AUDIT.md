# Tax Type Audit

## Model
TaxType: single accountId, float rate, Active/Inactive. Seed/catalog via malawiTaxSeed + Sync MRA Catalog.

## APIs
GET/POST /api/tax-types, /[id], seed, accounts, [id]/reports, reversed-taxes(+export).

## UI
app/tax-types/page.js — CRUD, balances, reports modal, defaults. Canonical catalogue.

## Classification
KEEP TaxType core. EXTEND for versioning/effective dates (Wave 3). MIGRATE UI to /tax-management/tax-codes.
