# Money and Rounding

Implementation: `lib/accountingV2/domain/money.js` (Phase 2 foundation, used
throughout the Phase 4 engine).

## Principles

- **No JavaScript `Number` for authoritative amounts.** All monetary values
  travel as decimal strings and are computed with exact decimal arithmetic
  (scaled-integer implementation in `money.js`). The API schemas
  (`contracts/apiSchemas.js`) reject numeric-typed amounts; the boundary test
  suite asserts no float acceptance in V2 schemas.
- Storage uses Prisma `Decimal(18,2)` columns (Phase 2 decision) —
  `totalDebit`, `totalCredit`, line `debitAmount`/`creditAmount`,
  `baseDebit`/`baseCredit`.

## Policies

| Policy | Value |
| --- | --- |
| Currency scale | 2 decimal places (MWK and supported two-decimal currencies); scale table extensible for zero-decimal currencies |
| Rounding mode | Half-up at currency scale |
| Line rounding | Each line rounded to currency scale before totalling |
| Document rounding | Totals are sums of rounded lines — no re-rounding drift |
| Tax rounding | Per tax line, at currency scale, per configured tax rules |
| Base-currency rounding | Applied after exchange-rate multiplication, at base-currency scale |
| Tolerance | Zero — an unbalanced draft is rejected; no automatic rounding line exists in Phase 4 (a rounding-account policy would be an explicit template feature) |

## Validation

`postingCommand.js` rejects non-decimal-string amounts, NaN/Infinity,
unsupported scale and prohibited negatives. Double-entry validation compares
exact decimal totals, not floating-point sums.

## Tests

The Phase 2 money suite plus Phase 4 engine tests cover: large amounts, small
fractional amounts, multi-line tax postings, exchange-rate arithmetic,
repeating decimals, high-scale inputs (rejected), and rounding edge cases.
