# Expense Account Coverage Audit

**Date:** 2026-07-25  
**Blueprint file:** `lib/chartOfAccountsBlueprint.js`  
**Purpose registry:** `lib/coaV2/domain/systemPurposes.js`

## Present operating / COGS coverage (blueprint)

| Band | Codes | Coverage |
|------|-------|----------|
| COGS group | `5100`–`5140` | Purchases, returns, freight, direct labour |
| Payroll | `5200`, `5210`, `5220` | Salaries, benefits, employer statutory |
| Occupancy / ops | `5300`–`5390` | Rent, utilities, telecom, supplies, marketing, travel, IT, professional, insurance, repairs, bad debts |
| Non-cash | `5400`, `5410` | Depreciation, amortization |
| Finance | `5500`, `5510` | Bank charges, interest |
| Other ops | `5600`, `5610` | Meals, training |
| Custom header | `5700` | Tenant 5701–5899 |
| Catch-all | `5900` | Requires reclassification |

**Tag:** Base operating set is `REUSE`; gaps below are `MISSING_ACCOUNT`.

## Missing / incomplete leaves

| Need | Suggested code | Evidence | Tag |
|------|----------------|----------|-----|
| Overtime / premium pay | e.g. `5205` under payroll | Not in blueprint; anti-template used `5205` for Equipment | `MISSING_ACCOUNT` |
| Fuel & vehicle (dedicated) | e.g. `5345` under travel | Anti-template had `5199` Fuel under wrong parent; blueprint only `5340` Travel & Transport | `MISSING_ACCOUNT` / `EXTEND` |
| Licences & permits | e.g. `5365` | Not in blueprint | `MISSING_ACCOUNT` |
| Foreign exchange loss | purpose `FOREIGN_EXCHANGE_LOSS` exists; **no legacyCode / no blueprint leaf** | `systemPurposes.js` | `MISSING_ACCOUNT` |
| Inventory adjustment | purpose `INVENTORY_ADJUSTMENT` `legacyCode: '5290'` | **5290 absent from blueprint array** | `MISSING_ACCOUNT` |
| Corporate tax expense | purpose `CORPORATE_TAX_EXPENSE` — no `legacyCode` | No blueprint tax expense leaf | `MISSING_ACCOUNT` |
| Project / job costs | e.g. under `5700` or dedicated `5620` | Not in blueprint | `MISSING_ACCOUNT` |
| FX gain (mirror) | purpose `FOREIGN_EXCHANGE_GAIN` | No blueprint leaf | `MISSING_ACCOUNT` |

## Purpose vs selectable expense accounts

`lib/coaV2/application/expenseAccountQuery.js`:

- Excludes COGS subtree `5100–5199` from ordinary expense selection unless `includeCostOfSales`.  
- If anti-blueprint seeded opex under `5100`, those accounts are **hidden from expense pickers** while still named “Operating Expenses” — silent coverage failure.

**Tag:** Interaction of `DUPLICATED` template + query filter = effective `MISSING_ACCOUNT` in UI.

## Selector path today

Expense UI/API uses CoA IDs via `/api/categories?type=expense`, which historically called `ensureExpenseAccountsForTenant` (anti-blueprint).  

**Target:** Selector must list blueprint-aligned postable expense leaves only (see [EXPENSE_ACCOUNT_SELECTION.md](./EXPENSE_ACCOUNT_SELECTION.md)).

## Coverage decision

| Item | Action |
|------|--------|
| Existing `5200`–`5610` leaves | `REUSE` |
| New leaves listed above | `EXTEND` blueprint (Phase 2) |
| Anti-template fuel/rent under 51xx | Do **not** promote; remap to blueprint codes |
| `5900` catch-all | `LEGACY_READ_ONLY` for new posting where possible; force reclassification |
