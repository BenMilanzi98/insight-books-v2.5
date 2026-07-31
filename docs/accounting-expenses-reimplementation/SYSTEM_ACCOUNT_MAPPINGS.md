# Design Stub — System Account Mappings

**Date:** 2026-07-25  
**Registry:** `lib/coaV2/domain/systemPurposes.js`  
**Storage:** `CoaV2AccountMapping` (+ `Account.systemPurpose` where used)

## Correction table (P0)

| Purpose | Current `legacyCode` | Target resolution | Notes |
|---------|----------------------|-------------------|-------|
| `VAT_INPUT` | `1150` | `1240` VAT Recoverable | Blueprint asset; fix backfill |
| `PRIMARY_BANK` | `1130` | Postable child under `1130` (e.g. `1131-01` policy) **or** purpose maps to configured leaf, never bare header | Blueprint: rollup-only |
| `COST_OF_SALES` | `5100` | Default leaf `5110` Purchases (or explicit mapping); engine rejects header | Group ≠ postable |
| `INVENTORY_ADJUSTMENT` | `5290` | Keep code; **add blueprint leaf** | `MISSING_ACCOUNT` today |
| `CORPORATE_TAX_EXPENSE` | _(none)_ | e.g. `5650` | Add leaf + legacyCode |
| `FOREIGN_EXCHANGE_LOSS` | _(none)_ | e.g. `5660` | Add leaf + legacyCode |

## Unchanged (verified against blueprint)

| Purpose | legacyCode | Tag |
|---------|------------|-----|
| `CASH_ON_HAND` | `1110` | `REUSE` |
| `PETTY_CASH` | `1120` | `REUSE` |
| `ACCOUNTS_PAYABLE` | `2110` | `REUSE` |
| `SALARIES_AND_WAGES` | `5200` | `REUSE` |
| `RENT_EXPENSE` | `5300` | `REUSE` |
| `UTILITIES_EXPENSE` | `5310` | `REUSE` |
| `BANK_CHARGES` | `5500` | `REUSE` |
| `INTEREST_EXPENSE` | `5510` | `REUSE` |
| `DEPRECIATION_EXPENSE` | `5400` | `REUSE` |

## Mapping rules

1. Exactly one active mapping per `(tenantId, purpose, context)` — COA-002.  
2. Mapped account must pass `validateAccountForPurpose`.  
3. Headers fail validation for posting behaviours.  
4. Expense module does not set purposes ad hoc; it uses `expenseAccountId` leaf + engine tax/cash purposes.

## Remap job outline

1. Detect mappings where purpose account code ∈ `{1150, 1130, 5100}` for VAT_INPUT / PRIMARY_BANK / COST_OF_SALES.  
2. Re-point to target leaf; leave old account deprecated via V2 lifecycle (**no JE rewrite** preferred).  
3. Emit audit row per tenant.
