# Phase 3 Migration & Build Validation (2026-07-20)

## 1. Database

- `npx prisma migrate status` → **97 migrations found — database schema is up to date**
  (includes `20260720110000_acctv2_foundation` and `20260720130000_coa_v2_governance`).
- Additive-only verified: the CoA V2 migration contains only `ALTER TABLE … ADD COLUMN`
  (nullable) and `CREATE TABLE`/`CREATE INDEX` statements.

## 2. Backfill

- `coa:classify:apply` classified **540/540 accounts across 5 businesses**;
  0 manual-review rows; rerun reports 540 skipped (idempotent).
- Spot checks: category/subtype/normal-balance combinations validate under
  `validateClassification`; blueprint-coded accounts carry blueprint classifications.

## 3. Integrity audit

- `npm run audit:forensic:coa-v2` → **0 findings**, 540 accounts / 5 businesses scanned,
  record counts unchanged (read-only proof).
  Report: `artifacts/accounting-audit/audit-run-2026-07-20T12-54-17-014Z.json`.

## 4. Tests

- `test/coaV2.domain.test.js` — **53 passed**: categories & normal balances (incl. contra
  and debit-normal equity), forbidden classifications, behaviours, lifecycle state machine,
  currency policy, hierarchy (cycles, depth, cross-business, derived totals/no double
  count), code governance (formats, anchors, controlled change, next-code), system purposes
  (constraints, elevated set), FS/CF mappings.
- `test/coaV2.services.test.js` — **20 passed**: mapping resolution (specificity,
  effective windows, typed errors for missing/cross-tenant/inactive/deprecated/header),
  assignment validation (unknown purpose, wrong business, wrong category, replace-not-
  duplicate), expense selector inclusion/exclusion matrix, salary enforcement (code-based
  duplicates, liability rejection), CSV formula-injection guards.
- Full suite: **493 passed / 8 failed / 3 skipped** — all 8 failures reproduced on a clean
  tree (`git stash` verification) and reference modules removed before Phase 3
  (`expenseCategoryCoa.js`, `mapSalaryAdvanceRegisterRow.js`, legacy income-statement
  rollup expectations). **No regressions introduced by Phase 3.**
- `accountingV2.boundaries.test.js` passes — the `lib/coaV2` layer respects the Phase 2
  architecture boundaries.

## 5. Lint & build

- `next lint` over `app/api/coa-v2`, `app/chart-of-accounts/governance`, `lib/coaV2`,
  `lib/accountingV2`, `test` → **no warnings or errors**.
- `npm run build` (production) → **compiled successfully**; all 12 `/api/coa-v2/*` routes
  and `/chart-of-accounts/governance` present in the route manifest.
