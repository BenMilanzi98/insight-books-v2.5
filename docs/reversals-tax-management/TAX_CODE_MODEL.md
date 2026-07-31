# Tax Code Model

## Current (KEEP)
`TaxType` remains the operational tax code catalogue:
- Identity: `taxId`, `taxCode`, `taxName`
- Rate: `taxRate` + `calculationType`
- Liability/asset link: single `accountId`
- Status: Active / Inactive
- Line snapshots: `SaleItemTax` (and product links via `ProductTax`) keep historical rates

## Wave 3 extensions
| Concern | Approach |
|---------|----------|
| Versioning | Additive fields on TaxType: `effectiveFrom`, `effectiveTo`, `supersededById` (optional). Historical sale lines keep snapshot rates. |
| Purpose mapping | New `TaxAccountMapping` (purpose → CoA accountId, effective-dated) — does not replace TaxType.accountId during dual-run |
| Subledger | `TaxTransaction` rows derived from posted V2 journal lines |

## Purposes (canonical)
- `VAT_OUTPUT`
- `VAT_INPUT`
- `TAX_PAYABLE`
- `TAX_RECEIVABLE`
- `WITHHOLDING_PAYABLE`
- `PRIMARY_BANK` (settlement credit side)

## Accumulated tax
Sum of `TaxTransaction.amountSigned` for open periods — never typed closing balances.
