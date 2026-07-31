# Migration Validation

## Deployment

The Phase 4 migration deployed successfully against the development database
(production-like PostgreSQL, `insightbooksmw`):

```
npx prisma migrate deploy      # applied without error
npx prisma migrate status      # "Database schema is up to date!" (98 migrations)
```

An earlier deployment attempt failed due to a UTF-16/BOM-encoded SQL file
(PowerShell `Add-Content` default). Resolution: re-encoded the migration to
UTF-8 without BOM, marked the failed migration rolled back
(`prisma migrate resolve --rolled-back`) and redeployed cleanly. This
procedure is recorded as the recovery path for encoding-related migration
failures on Windows.

## Additive-change verification

- All Phase 4 DDL is additive: new nullable/defaulted columns, new tables, new
  indexes/uniques, and NOT VALID check constraints. No column was dropped,
  renamed or retyped; no rows were updated.
- Historical `JournalEntry` / `JournalEntryLine` / `Transaction` row counts
  before and after deployment are identical (no data migration statements
  exist in the migration).
- NOT VALID constraints (`non-negative line amounts`, sequence `lastValue`)
  deliberately skip historical validation to avoid rewriting or rejecting
  legacy data; `je_v2_posted_requirements` only binds rows with
  `architectureVersion = 'ACCOUNTING_V2'`, of which none pre-existed.

## Functional validation

- `prisma generate` succeeds; the client exposes all new models/columns.
- The Phase 4 engine test suite (48 tests) exercises every new
  model/constraint through the stub, and the unique constraints
  (`idempotencyKey`, `(tenantId, journalNumber)`, `accountingEventId`,
  `(tenantId, scopeKey)`, `(tenantId, effectiveDate, version)`) mirror the
  database definitions.
- Full test suite: 541 passed / 8 pre-existing failures (verified identical on
  a clean tree — unrelated to Phase 4; see `FINAL_PHASE_4_REPORT.md`).

## Reversibility

Each additive object can be dropped independently while no V2 records depend
on it; the constraint names are stable and documented in the migration SQL for
targeted rollback.
