# Default Account Template Audit

**Date:** 2026-07-25  
**Verdict:** Multiple templates compete with `lib/chartOfAccountsBlueprint.js`. Treat blueprint as SoT; classify others `DUPLICATED` / retire.

## Canonical template

| Item | Path | Tag |
|------|------|-----|
| Blueprint array | `lib/chartOfAccountsBlueprint.js` | `REUSE` |
| CoA V2 apply | `lib/coaV2/templates/coaTemplates.js` | `REUSE` |
| Comprehensive remap map | `lib/coaComprehensiveTemplateMap.js` | `REUSE` (maps old template codes → blueprint) |

Blueprint: **`5100` = Cost of Sales** (group). Operating expenses live at `5200+` / `5300+`, not under 5100 as “opex parent”.

## Anti-blueprint: `lib/expenseCategoriesTemplate.js`

**Tag:** `DUPLICATED`

| Code in template | Template name | Blueprint name | Collision |
|------------------|---------------|----------------|-----------|
| `5100` | Operating Expenses | Cost of Sales | **Semantic invert** |
| `5120` | Rent Expense | Purchase Returns & Discounts | Wrong |
| `5130` | Utilities Expense | Freight & Import Costs | Wrong |
| `5140` | Office Supplies Expense | Direct Labour | Wrong |
| `5190` | Bank Charges | (COGS band) | Wrong band |
| `5195` | Depreciation Expense | — | Blueprint depreciation is `5400` |

`ensureExpenseAccountsForTenant` **creates** missing rows with these wrong names/parents. Callers include:

- `lib/budgetService.js`
- `lib/incomeStatementService.js`
- Categories / expense dropdown ensure paths

**Impact:** New tenants (or lazy ensure) get a polluted chart where COGS code means opex, breaking P&L rollups that treat `5100–5199` as Cost of Sales (`lib/coaV2/application/expenseAccountQuery.js` excludes 5100–5199 from ordinary expense selection).

## Anti-blueprint: `lib/accountTemplates.js`

**Tag:** `DUPLICATED`

Industry packs reuse `5100` for unrelated leaves, e.g.:

- Rent Expense  
- Direct Labor  
- Administrative Expenses  

Same code, different meaning per pack — incompatible with a single-tenant blueprint.

## Normalization: `lib/expenseCategoryNormalization.js`

**Tag:** `DUPLICATED` / `INCORRECT_POSTING` (when used to seed or classify)

Used with `lib/incomeStatementOperatingExpenseRollup.js` which imports `EXPENSE_ACCOUNTS_TEMPLATE` and maps category text to “standard sync codes” in the anti-blueprint band. Rollup logic already special-cases blueprint COGS `5100` — evidence the two worlds are fighting.

## Remediation (Phase 1)

1. Stop creating accounts from `EXPENSE_ACCOUNTS_TEMPLATE`.  
2. Point ensure helpers at blueprint ensure / CoA V2 template apply.  
3. Add remap for tenants already seeded with anti-blueprint `5100` Operating Expenses (use `lib/coaComprehensiveTemplateMap.js` patterns).  
4. Align normalization maps to blueprint leaves (`5300` rent, `5310` utilities, `5500` bank charges, etc.).  
5. Quarantine `accountTemplates.js` expense sections or delete once unused.

## Acceptance checks

- [ ] No code path creates `accountCode=5100` with name containing “Operating Expenses”.  
- [ ] `expenseAccountQuery` and income-statement opex rollup agree on 5100–5199 = COGS only.  
- [ ] Unit test locks blueprint name for `5100`.
