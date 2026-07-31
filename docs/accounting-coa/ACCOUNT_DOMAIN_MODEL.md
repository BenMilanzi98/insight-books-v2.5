# Target Account Domain Model (Phase 3)

The V2 account model is layered **additively** onto the existing `Account` table: every new
column is nullable, legacy columns are untouched, and legacy reads keep working. The V2
domain layer lives under `lib/coaV2/domain/` and is pure (no framework or database imports).

## 1. Identity and business scope

| Field | Notes |
|---|---|
| `id` | Existing cuid primary key (unchanged) |
| `tenantId` | Business scope. Still nullable in the DB (legacy blocker); every V2 service requires it and treats NULL as an integrity finding (COA-012) |
| `accountCode` / `code` | Legacy duplicate column family retained; V2 governance normalizes via `normalizeAccountCode` and validates `NNNN` / `NNNN-NN` formats |
| `accountName` / `name` | Legacy duplicate family retained; uniqueness enforced per business at the API layer |

## 2. Classification (new nullable columns)

| Column | Domain source | Values |
|---|---|---|
| `coaV2Category` | `AccountCategory` (Phase 2 enum) | ASSET, LIABILITY, EQUITY, REVENUE, COST_OF_SALES, EXPENSE, OTHER_INCOME, OTHER_EXPENSE |
| `coaV2SubType` | `AccountSubType` (`categories.js`) | 40+ subtypes; each valid only under its category (`CATEGORY_SUBTYPES`) |
| `coaV2NormalBalance` | `AccountNormalBalance` | DEBIT / CREDIT — **derived, never user-selected**: `expectedNormalBalance(category, subType)`; contra subtypes flip the category default; DRAWINGS/DIVIDENDS are debit-normal equity |
| `coaV2Behaviour` | `AccountBehaviour` (Phase 2 enum) | HEADER, POSTING, CONTROL, SYSTEM, CONTRA — capability matrix in `BEHAVIOUR_RULES` |
| `coaV2Status` | `AccountLifecycleStatus` | ACTIVE → DEPRECATED → ARCHIVED (restore allowed; ARCHIVED → DEPRECATED forbidden) |

Forbidden classifications are hard errors (`forbiddenClassificationError`):
owner capital/contributions as REVENUE; drawings as EXPENSE.

## 3. Posting rules

| Column | Meaning |
|---|---|
| `postingAllowed` | Account-level gate; HEADER must be false |
| `manualPostingAllowed` | CONTROL/SYSTEM accounts false — manual journals restricted |
| `acceptsNewTransactions` | Legacy flag kept in sync by lifecycle service |

Effective rule: `accountAcceptsNewPostings({behaviour, status, postingAllowed, isActive})`
— deprecated, archived, inactive, header, and posting-disallowed accounts never accept new lines.

## 4. System wiring

| Column | Meaning |
|---|---|
| `systemPurpose` | One `SystemAccountPurpose` (53-key registry) — unique per business per purpose (COA-002) |
| `controlAccountPurpose` | Subledger control identity (AR, AP, …) |

## 5. Financial reporting

| Column | Meaning |
|---|---|
| `financialStatementSection` | Explicit statement section (`FinancialStatementSection`); category-compatible only (`CATEGORY_ALLOWED_SECTIONS`) |
| `cashFlowClassification` | OPERATING / INVESTING / FINANCING / CASH_AND_CASH_EQUIVALENT / NON_CASH / UNCLASSIFIED |

Sign presentation for contra accounts comes from `signPresentation(category, subType)` — stored
balances are never sign-flipped.

## 6. Currency policy

| Column | Meaning |
|---|---|
| `currencyPolicy` | BASE_CURRENCY_ONLY / MULTI_CURRENCY / SPECIFIC_CURRENCY |
| `specificCurrency` | ISO-4217, required (and only valid) with SPECIFIC_CURRENCY |

## 7. Hierarchy

| Column | Meaning |
|---|---|
| `parentAccountId` | Existing self-relation; V2 validates via `validateParentAssignment` (same business, same category, no cycles, max depth 6, posting-parents rejected) |
| `hierarchyDepth`, `hierarchyPath` | Materialized metadata written by backfill/services |

Parent totals are **derived from descendants only** (`deriveSubtreeBalance`) — a parent's own
stored balance is excluded, eliminating the CAP-002 double-count class.

## 8. Lifecycle & succession

| Column | Meaning |
|---|---|
| `deprecationReason` | Required (min 5 chars) on deprecate |
| `replacementAccountId` | Required when deprecating an account with historical activity |
| `archivedAt`, `coaEffectiveFrom`, `coaEffectiveTo` | Timeline metadata |
| `coaArchitectureVersion` | LEGACY / TRANSITION_V2 provenance marker |
| `coaV2UpdatedBy` | Last governance actor |

## 9. Field-change policy (`accountModel.js`)

- **SAFE** (name, description, display order): editable with `coa.update`.
- **RESTRICTED** (category, subtype, behaviour, normal balance, parent, FS/CF mapping,
  currency policy): requires no historical activity OR documented reason + elevated
  permission; every change audited.
- **IMMUTABLE_AFTER_HISTORY** (account code): only through the controlled process
  (`validateAccountCodeChange` — authorization + reason + impact analysis + alias). Approved
  anchors (5000/5100/5200) can never be renumbered.

## 10. What is deliberately NOT here

- No balance storage changes — Phase 3 does not restate ledgers.
- No `tenantId NOT NULL` constraint yet (existing NULL rows are Phase 3 findings, tightened
  in a later approved migration).
- No removal of the duplicate legacy column families (`code`/`accountCode`, …) — deferred
  until production verification.
