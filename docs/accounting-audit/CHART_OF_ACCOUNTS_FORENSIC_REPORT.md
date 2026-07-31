# Chart of Accounts Forensic Report

Run: `npm run audit:forensic -- --module coa` • Artifacts:
`artifacts/accounting-audit/accounts.csv` (all 540 accounts, all tenants).

## Data findings (current DB, 540 accounts across 5 tenants)

| Check | Result |
|---|---|
| Duplicate account codes per tenant (COA-001) | **0** (enforced by `@@unique([tenantId, accountCode])`) |
| Accounts with NULL tenantId | 0 (column nullable — structural risk W4) |
| Parent-child cycles / orphan parents (COA-007) | 0 |
| Parent accounts with direct postings (COA-003) | 0 (blocked by `coaDirectPostingEligibility`) |
| Inactive accounts with posted lines (COA-006) | 0 |
| Purpose-duplicate groups (COA-002) | 0 flagged on active accounts (blueprint CoA is consistent) |
| Accounts missing code/name (COA-004) | 0 |

The per-tenant CoA is generated from a single blueprint (`lib/chartOfAccountsBlueprint.js`),
which explains the clean structural state. Production tenants that predate the blueprint
migration (`lib/chartOfAccountsCanonicalMigration.js`, `CoaMigrationLog`) are where duplicates
concentrate; re-run against production copy.

## Code-level findings (independent of data)

### Salary accounts
- The canonical rule exists and is enforced *for expenses*: `lib/accountingMappingRules.js`
  pins salary-like postings to **5200 Salaries & Wages** (`CANONICAL_SALARY_ACCOUNT_CODE`) and
  rejects salary-like duplicates (`5301 Salaries & Wages (legacy duplicate)` pattern in tests).
- `lib/salaryExpenseAccountCodes.js` + `scripts/consolidate-salary-accounts.js` exist because
  multiple historical salary accounts were real; the consolidation runs on demand (not enforced
  in DB). Salary-family duplicates remain detectable via COA-002.

### Mapping resolution (no mapping registry)
- Account resolution is **code-constant based**: `lib/coaPostingCodes.js`,
  `cogsGlAccount.js`, `inventoryGlAccount.js`, `salaryAdvanceGlAccount.js`,
  `openingBalanceEquityAccount.js`, `resolveCapitalAccount.js`, `defaultRevenueAccount.js`, etc.
  Each resolver looks up by `(tenantId, accountCode)` and often **creates the account if
  missing** ("ensure" pattern). Consequences:
  - Hardcoded account codes live in ~10 modules (documented list in `REPOSITORY_ACCOUNTING_MAP.md`).
  - A tenant whose CoA diverges from the blueprint gets silently created accounts.
  - `updateAccountBalanceOnTransaction` even **redirects** postings on code `1300` to an
    ensured leaf (`accountBalanceService.js:220`) — mapping logic embedded in balance math.
- No `AccountMapping` table exists → COA-008 (missing mapping) is not machine-checkable; it is a
  Phase 2 deliverable to introduce a mapping registry.

### Hierarchy / rollup
- Parent accounts are posting-blocked via `acceptsNewTransactions=false` + eligibility checks —
  good. Display rollups (`coaChartRollup.js`, `coaStructureDisplayBalance.js`) compute subtree
  sums for presentation; any consumer adding parent display balance + child balances
  double-counts (hazard TB-003/CAP-002 monitors data-side).
- Merge machinery (`mergedIntoAccountId`, `accountMergeRollup.js`) redirects reporting to
  survivor accounts while posting stays on source rows — correct if every report uses the
  rollup helpers; reports that skip the helper double-list merged accounts.

### Legacy duplicate columns
`code/accountCode`, `name/accountName`, `type/accountType` coexist on `Account` (W8); most new
code reads the `account*` forms, some legacy paths still read `code/name/type` — a rename that
updates one column family desynchronizes the other.

## Expense-category integrity
Expense categories map to CoA accounts via `ExpenseCategory.accountId` (1:1 relation) and
`lib/expenseGlPosting.js` validates the target is an active, postable Expense-range (5000-5999)
leaf — the mandated control exists. Legacy remaps live in `lib/legacyExpenseAccountRemaps.js`.
