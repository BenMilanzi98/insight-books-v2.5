# System Account Registry & Account Mapping (Phase 3)

## 1. Purpose catalogue

`lib/coaV2/domain/systemPurposes.js` defines **53 system account purposes** as the single
source of truth. Each purpose carries validation constraints:

- allowed categories (e.g. `SALARIES_AND_WAGES` → EXPENSE only, never LIABILITY);
- allowed behaviours (e.g. `ACCOUNTS_RECEIVABLE` → CONTROL);
- required normal balance (e.g. `ACCUMULATED_DEPRECIATION` → CREDIT on a CONTRA asset);
- expected subtypes (warnings when unusual);
- `protectedAccount` — the mapped account can never be deleted/archived while mapped;
- `manualPostingRestricted` — manual journals require elevated permission;
- `legacyCode` — the blueprint code used by the transition fallback.

**8 elevated purposes** (protected or manual-posting-restricted, e.g. RETAINED_EARNINGS,
OPENING_BALANCE_EQUITY, SUSPENSE_ACCOUNT, AR/AP controls) additionally require
`coa.manageSystemAccounts` / `coa.manageControlAccounts` to (re)map.

Key purpose families:

| Family | Purposes (examples) |
|---|---|
| Cash & banking | CASH_ON_HAND, PRIMARY_BANK, MOBILE_MONEY |
| Receivables/Payables | ACCOUNTS_RECEIVABLE, ACCOUNTS_PAYABLE (CONTROL) |
| Inventory & COGS | INVENTORY, COST_OF_SALES, INVENTORY_ADJUSTMENT |
| Tax | VAT_OUTPUT, VAT_INPUT, VAT_PAYABLE, PAYE_PAYABLE, WITHHOLDING_TAX_PAYABLE, CORPORATE_TAX |
| Payroll | SALARIES_AND_WAGES (canonical 5200), SALARY_ADVANCE, PENSION_PAYABLE |
| Equity | OWNER_CAPITAL, RETAINED_EARNINGS, CURRENT_YEAR_EARNINGS, OWNER_DRAWINGS, OPENING_BALANCE_EQUITY |
| Revenue | SALES_REVENUE, SERVICE_REVENUE |
| Special | SUSPENSE_ACCOUNT (deliberate policy only), ROUNDING_DIFFERENCE, FX gain/loss |

## 2. Mapping registry (`CoaV2AccountMapping`)

Business-scoped table replacing hardcoded account codes and name matching:

```text
(tenantId, purpose, moduleKey, transactionType, currency, branchKey) → accountId
```

- `"*"` sentinels mean "any"; the resolver picks the **most specific** active row
  (module > transactionType > currency > branch), then priority.
- Effective-date windows (`effectiveFrom`/`effectiveTo`) support scheduled remaps.
- Unique constraint prevents conflicting duplicates for the same purpose+context.
- Rows are retired (status `RETIRED`), never deleted.

## 3. Resolution rules (`accountMappingRegistry.js`)

`resolvePurposeAccount(context, purpose, opts)` — the ONLY sanctioned way for modules to
find a system account:

1. Registry row for the business + context (most specific wins).
2. Mapped account re-validated at resolution time: same business, active, not
   deprecated/archived, not a header/parent, accepts new postings — typed errors
   (`InactiveAccountError`, `NonPostingAccountError`, `CrossTenantAccountingError`) otherwise.
3. No registry row:
   - while `coaV2CanonicalMappings` flag is **off** for the business → Phase 2 legacy
     blueprint-code adapter (typed errors, no auto-create);
   - when the flag is **on** → `MissingAccountMappingError`. **Never** name matching,
     first-in-category, cross-business accounts, or silent account creation.

The Phase 2 `AccountMappingService` contract in
`lib/accountingV2/contracts/serviceContracts.js` is now backed by this resolver, so every
Phase 2 caller upgraded automatically.

Legacy mapping keys (e.g. `SALARIES_EXPENSE`, `DEFAULT_REVENUE`) are accepted and
normalized to V2 purposes via `PURPOSE_BY_LEGACY_KEY`.

## 4. Assignment & retirement

- `assignMapping` validates the target account against the purpose constraints
  (`validateAccountForPurpose`) before upserting; replaced mappings are captured for audit.
- `retireMapping` ends resolution without deleting history.
- API: `GET/POST /api/coa-v2/mappings`, `DELETE /api/coa-v2/mappings/[id]` —
  `coa.mapAccounts` required; elevated purposes additionally require
  `coa.manageSystemAccounts`; every change writes a `coa.mapping.*` audit record.

## 5. Aliases (`CoaV2AccountAlias`)

Legacy codes/names map to canonical accounts for **future** lookups
(`resolveAccountByCodeOrAlias`): active account first, then alias, then
deprecated-with-replacement. Historical journal lines keep their original account ids.
