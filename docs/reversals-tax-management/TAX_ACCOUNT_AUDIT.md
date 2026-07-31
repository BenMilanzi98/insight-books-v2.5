# Tax Account Audit

## Surfaces
- app/tax-accounts/page.js + [id]
- /api/tax-accounts/balances, /[id]/balance
- Fixed 2041/2045 initialization
- TaxType.accountId linkage

## V2 purposes
VAT_OUTPUT / VAT_INPUT in sale/purchase templates; settle uses TaxType account metadata lines more than purpose resolution.

## Classification
KEEP balance aggregation. MIGRATE UI to /tax-management/accounts. EXTEND purpose→CoA effective-dated mappings (Wave 3).
