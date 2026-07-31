# Chart of Accounts Audit

**Date:** 2026-07-25  
**Tags:** `REUSE` (blueprint), `DUPLICATED` (templates / merge / dual columns), `MISSING_ACCOUNT`, `INCORRECT_POSTING` (purposes)

## Source of truth

| Layer | Path | Role |
|-------|------|------|
| Operational account rows | Prisma `Account` | Tenant chart rows |
| Purpose / mapping | `CoaV2AccountMapping` + `lib/coaV2/domain/systemPurposes.js` | System purpose resolution |
| Structural blueprint | `lib/chartOfAccountsBlueprint.js` | Canonical codes/names/parents |
| Template apply | `lib/coaV2/templates/coaTemplates.js` | Approved industry/blueprint apply |

**Classification:** Blueprint + `Account` + mappings = SoT. Anything that creates competing codes is `DUPLICATED`.

## Blueprint facts (expense-relevant)

From `lib/chartOfAccountsBlueprint.js`:

| Code | Name | Note |
|------|------|------|
| `5000` | Expenses | Header / roll-up only |
| `5100` | Cost of Sales | **Group** under 5000 — not Operating Expenses |
| `5110`–`5140` | Purchases, returns, freight, direct labour | COGS leaves |
| `5200` | Salaries & Wages | Operating |
| `5300`–`5610` | Rent, utilities, marketing, … | Operating leaves |
| `5700` | Custom Expenses | Header for tenant 5701–5899 |
| `5900` | All Other Expenses | Catch-all; reclassification flag |
| `1130` | Bank - Primary | Parent for 1131–1138; **rollup-only** |
| `1240` | VAT Recoverable | Input VAT asset |

## Dual columns: `code` / `accountCode`

**Risk:** Lookups inconsistently use `accountCode`, `code`, or `OR` of both (e.g. `lib/cogsIntegration.js`).  
**Classification:** `DUPLICATED` identity.  
**Impact:** Merge, COGS resolve, and template ensure can attach activity to the wrong row if one column is stale.

**Remediation direction:** Single canonical column for queries (prefer `accountCode` per CoA V2); backfill; fail audits when `code !== accountCode` for active rows.

## Anti-blueprint seeders (detailed in DEFAULT_ACCOUNT_TEMPLATE_AUDIT)

| File | Conflict |
|------|----------|
| `lib/expenseCategoriesTemplate.js` | `5100` = **Operating Expenses**; children rent/utilities under 5100 |
| `lib/accountTemplates.js` | Industry packs assign `5100` to Rent / Direct Labor / Admin |
| `lib/expenseCategoryNormalization.js` | Sync codes aligned to anti-blueprint band |

## Merge policy: DUPLICATED

| Path | Behaviour | Tag |
|------|-----------|-----|
| CoA V2 lifecycle (`app/api/coa-v2/accounts/[id]/lifecycle`) | Deprecate / block without rewriting posted journal lines | `REUSE` (correct immutability) |
| `app/api/chart-of-accounts/merge/route.js` | `journalEntryLine.updateMany` sets `accountId: target.id` (and many other FKs) | `DUPLICATED` / rewrite |

**Finding:** Two merge philosophies coexist. Rewriting `JournalEntryLine` mutates financial history in place and can also touch `Account.balance` aggregation paths in the same transaction.

## Purpose legacyCode bugs

Defined in `lib/coaV2/domain/systemPurposes.js`:

| Purpose | Current `legacyCode` | Blueprint truth | Tag |
|---------|----------------------|-----------------|-----|
| `VAT_INPUT` | `1150` | `1240` VAT Recoverable | `INCORRECT_POSTING` |
| `PRIMARY_BANK` | `1130` | Header; post to 113x-yy children | `INCORRECT_POSTING` |
| `COST_OF_SALES` | `5100` | Header group; post to 5110+ | `INCORRECT_POSTING` |
| `INVENTORY_ADJUSTMENT` | `5290` | Purpose declares 5290; **leaf missing from blueprint array** | `MISSING_ACCOUNT` |

## Missing expense leaves (summary)

Not present (or only as purpose without blueprint row): overtime, fuel (dedicated), licences, FX loss, inventory adjustment `5290`, corporate tax expense, project costs. Full list: [EXPENSE_ACCOUNT_COVERAGE_AUDIT.md](./EXPENSE_ACCOUNT_COVERAGE_AUDIT.md).

## Classification matrix (CoA components)

| Component | Tag |
|-----------|-----|
| `lib/chartOfAccountsBlueprint.js` | `REUSE` + `EXTEND` (add leaves) |
| `lib/coaV2/*` mapping & classification | `REUSE` + purpose fixes |
| `lib/expenseCategoriesTemplate.js` | `DUPLICATED` — retire |
| `lib/accountTemplates.js` expense codes | `DUPLICATED` — retire/align |
| Legacy merge rewrite | `REFACTOR` to match V2 no-rewrite |
| Dual `code`/`accountCode` | `DUPLICATED` — unify |
