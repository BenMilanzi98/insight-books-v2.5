# Current Chart of Accounts Architecture (pre-Phase 3)

Snapshot of the implementation as inspected on 2026-07-20, before any Phase 3 change.

## 1. Model and tables

`Account` (prisma/schema.prisma):

- Identity: `id` (cuid), `tenantId` (nullable String, FK → Tenant with **cascade delete**).
- Duplicate column families (W8): `code`/`accountCode`, `name`/`accountName`,
  `type`/`accountType` (+ `accountSubtype`), `normalBalance` (free String: 'Debit'/'Credit').
- Hierarchy: `parentAccountId` self-relation; no cycle protection in DB.
- Stored balance: `balance Decimal(18,2)` (incrementally updated — drift risk R-04).
- Merge machinery: `mergedIntoAccountId` (logical merge), `CoaMigrationLog` audit table.
- Lifecycle-ish flags: `isActive`, `isSystem`, `requiresReclassification`, `retiredAt`,
  `migratedToAccountCode`, `acceptsNewTransactions`, `visibleInChart`.
- Constraints: `@@unique([tenantId, accountCode])`; indexes on tenantId, accountType,
  isActive, parentAccountId, accountCode, mergedIntoAccountId.
- ~25 relations into operational models (expenses, products, invoices, taxes, payment
  accounts, journal/transaction lines, budget lines, equity accounts…).

`ExpenseCategory`: `name`, unique `accountId` → Account, `accountCode`, tenant-scoped uniques.

No mapping registry, no alias table, no template versioning, no behaviour column, no
financial-statement or cash-flow mapping columns.

## 2. Account creation paths

1. **Tenant onboarding** — `initializeNewTenantFinancialDefaults` →
   `ensureChartOfAccountsForTenant` (blueprint `CHART_OF_ACCOUNTS_BLUEPRINT`, ~90 accounts,
   roots 1000/2000/3000/4000/5000) + payment/tax defaults. Callers: register, signup,
   tenant add, admin tenants, `/api/chart-of-accounts/bootstrap`.
2. **Manual create** — `POST /api/chart-of-accounts` (`accountService.createAccount`),
   guarded by `accounts.create` + `canCreateChartOfAccount` + CoA lock.
3. **Legacy create** — `POST /api/accounts` (older surface; session-only auth).
4. **Silent "ensure" creation during posting** — `cogsIntegration` (5100…),
   `inventoryGlAccount` (1310/1300), `capitalCoaHelpers` (3100/3000),
   `openingBalanceEquityAccount` (3190), `taxAccountsInitialization` (2041/2045),
   `salaryAdvanceGlAccount` (1216), `inventoryWriteOffJournal` (5290),
   `paymentAccountCoaLink` (1110/1130 + children), `expenseCategoryNormalization`
   (name → code map, allocates next expense code), `incomeStatementExpenseAccountResolution`
   (can create 5200), `transactionJournalHelpers`.
5. **Legacy template import** — `POST /api/chart-of-accounts/import-template` seeds an
   **older** numbering that conflicts with the blueprint (EXP-TPL-DRIFT).
6. **Admin System CoA** — `SystemCoaDefinition` + `applySystemCoaPayloadToAllTenants`.

## 3. Account resolution for posting (the core problem)

No registry exists. Resolution is per-module hardcoded constants, sometimes with name
fallbacks, and often creates accounts if missing:

| Purpose | Module | Mechanism |
|---|---|---|
| AR 1200 / AP 2110 | `coaPostingCodes.js` | code first, **name fallback** |
| Revenue 4100/4150/4200 | `coaIncomeAccounts.js`, `defaultRevenueAccount.js` | preferred-code cascade |
| Cash/bank/mobile | `paymentMethodAccountMapping.js`, `cashAccountCoa.js`, `paymentAccountCoaLink.js` | code lists + **name keywords**; ensure-creates |
| COGS 5100 | `cogsIntegration.js`, `cogsGlAccount.js` | code; ensure-creates |
| Inventory 1310/1300 | `inventoryGlAccount.js` | code; ensure-creates |
| Salaries 5200 (+2130/2140/1216) | `accountingMappingRules.js`, `payrollEngine/accountMappings.js` | code; canonical-salary rule |
| Capital 3100 / OBE 3190 / RE 3200 | `capitalCoaHelpers.js`, `openingBalanceEquityAccount.js` | code; ensure-creates |
| Tax 2041/2045 | `taxAccountsInitialization.js`, `malawiTaxCatalog.js` | code; ensure-creates |
| Expense selection | `accountingMappingRules.js` → 5000–5999 postable leaves | range + salary-duplicate exclusion |
| Catch-alls 1999/2999/4900/5900 | `coaMigration/resolveMapping.js` | code |

Phase 2 added `resolveLegacyMappedAccount` (18 keys, no auto-create, typed errors) as the
transitional `AccountMappingService` backing — the only registry-shaped component so far.

## 4. APIs

- `/api/chart-of-accounts` (+`[id]`, `merge`, `bootstrap`, `picker`, `picker/balance`,
  `gl-subtree`, `income-accounts`, `import-template`) — RBAC via `accounts.*` +
  `chartOfAccountsAccess.js` helpers + tenant CoA lock (423).
- `/api/accounts/**` — older parallel surface (CRUD, cash, export, import, templates,
  opening-balances, reconcile) with session-only auth on several routes (PERM-COARSE).
- Admin: `/api/admin/system-coa` (+apply, tenant-accounts), `/api/admin/coa-migration`.
- Related: `/api/categories?type=expense`, `/api/expense-categories` (GET only).

## 5. UI

- `app/chart-of-accounts/page.js` — tenant CoA (tree via `SystemLedgerCoaTable`,
  merge/bootstrap/template actions, business scope selector).
- `app/insightbooks/chart-of-accounts/page.js` — admin System CoA editor.
- Pickers embedded in POS, assets, budget-forecast, rentals, customization, tax-types,
  opening-balances.

## 6. Update/delete logic

- `PUT /api/chart-of-accounts/[id]` — field updates; no restricted-field workflow, no
  reason/audit requirement for reclassification.
- `DELETE` — soft-deactivate rules; hard delete blocked when references exist.
- `POST /api/chart-of-accounts/merge` — logical merge (`mergedIntoAccountId`) that remaps
  activity for reporting; not a first-class alias model.

## 7. Known risks carried into Phase 3

| Risk | Description |
|---|---|
| R-15 | Hardcoded account codes in ~20 modules; no registry |
| R-15b | Ensure-pattern silently creates accounts during posting |
| W8 | Duplicate `code/accountCode` column families desynchronize |
| W4 | `Account.tenantId` nullable + cascade delete from Tenant |
| SAL-DUP | Historical salary-account duplicates (5200 canonical) |
| EXP-TPL-DRIFT | Legacy expense template conflicts with blueprint numbering |
| CAP-002 | Parent+child double count (MK1M → MK2M capital display) |
| TB-003 | Header accounts appear as balances in reports |
| MERGE-ROLLUP | Reports skipping merge helpers double-list accounts |
| NAME-FALLBACK | Name matching in AP/AR/payment/expense resolution |
| PERM-COARSE | `/api/accounts/*` session-only authorization |
| DEV-DATA-LIMIT | Local DB is blueprint-clean; production copy needed for real duplicate register |

## 8. What is already good (preserve, don't rebuild)

- `@@unique([tenantId, accountCode])` — per-business code uniqueness enforced.
- `coaDirectPostingEligibility.js` — parents blocked from direct postings.
- Expense selector already restricted to active postable 5000–5999 leaves with salary-
  duplicate exclusion.
- Blueprint-driven onboarding gives new tenants a coherent CoA.
- `acceptsNewTransactions` flag exists as a deprecation primitive.
- Phase 2 `AccountMappingService` contract with typed failure semantics.
