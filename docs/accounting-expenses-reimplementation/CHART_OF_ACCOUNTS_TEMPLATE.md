# Design Stub — Chart of Accounts Template

**Date:** 2026-07-25  
**Status:** Target contract (not empty)  
**SoT file:** `lib/chartOfAccountsBlueprint.js`  
**Apply path:** `lib/coaV2/templates/coaTemplates.js`

## Contract

1. Exactly one structural blueprint drives default accounts for new / migrated tenants.  
2. Industry packs may **add** optional leaves in allowed ranges (`5701–5899` custom); they must not redefine `5100`–`5140` or cash/VAT headers.  
3. Template apply is idempotent per `(tenantId, accountCode)`.  
4. Headers (`subtype: Group` / documented rollup-only) are never postable.

## Forbidden templates (retire)

| File | Reason |
|------|--------|
| `lib/expenseCategoriesTemplate.js` | `5100` = Operating Expenses |
| Colliding sections of `lib/accountTemplates.js` | Reuses `5100` for rent/labour/admin |

## Required roots (unchanged)

`1000` Assets · `2000` Liabilities · `3000` Equity · `4000` Income · `5000` Expenses.

## Expense band rules

| Range | Meaning | Postable |
|-------|---------|----------|
| `5100` | Cost of Sales **group** | No |
| `5110–5199` | COGS leaves | Yes (leaf only) |
| `5200–5699` | Operating (system) | Yes (leaf only) |
| `5700` | Custom header | No |
| `5701–5899` | Tenant custom | Yes |
| `5900` | Catch-all | Discouraged for new posts |

## Dual column policy

On create/apply: set `accountCode` (canonical). Keep `code` equal to `accountCode` until column retirement. Integrity job fails tenant if they diverge.

## Classification

| Item | Tag |
|------|-----|
| Blueprint | `REUSE` |
| V2 apply | `REUSE` |
| Anti-templates | `DUPLICATED` → remove |
| New leaves | `EXTEND` — see hierarchy stub |
