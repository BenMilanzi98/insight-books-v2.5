# Migration Validation — 20260720110000_acctv2_foundation

## What was validated (2026-07-20, local QA database = restored production-like copy)

| Check | Result |
|---|---|
| Content review | 194-line SQL: only `CREATE TABLE` (8), `CREATE INDEX`/`CREATE UNIQUE INDEX`, and FKs **between new tables**. Zero `ALTER`/`DROP`/`UPDATE` on legacy objects |
| Apply on production-like data | `prisma migrate deploy` succeeded (after stripping a PowerShell UTF-8 BOM from the generated SQL — see incident note) |
| Rerun safety | `prisma migrate status` → "Database schema is up to date!"; deploy is a no-op on rerun (96 migrations tracked) |
| Existing-data compatibility | Legacy counts identical before/after: Transaction 19, TransactionLine 39, JournalEntry 6, JournalEntryLine 8, Account 540 |
| Empty-new-tables | All 8 AcctV2 tables present with 0 rows |
| Empty database | The migration folder participates in the standard chain; on an empty DB `migrate deploy` creates all 96 migrations in order (new tables have no dependency on legacy data) |
| Duplicate legacy data | Not applicable: unique constraints exist only on the NEW empty tables, so legacy duplicates cannot fail this migration |
| Null legacy fields | Not applicable: no legacy column touched |
| Locks / duration | `CREATE TABLE`+`CREATE INDEX` on empty tables: momentary catalog locks only; measured apply < 2 s locally; no long lock possible on production since no existing table is scanned |
| Rows affected | 0 legacy rows |
| Interrupted-migration simulation | Exercised in reality: the first (BOM-corrupted) apply failed mid-transaction; Postgres rolled back; `prisma migrate resolve --rolled-back` + redeploy recovered cleanly |
| Rollback | Verified procedure in `DATABASE_FOUNDATION.md` (drop 8 tables + delete migration row); safe because nothing references the new tables from legacy schema |

## Incident note (recorded for reproducibility)

`prisma migrate dev` cannot run locally: the DB user lacks `CREATEDB` for Prisma's shadow
database (P3014). Procedure used instead, and mandated for future Phase ≥ 3 migrations in
this environment:

```powershell
# 1. generate SQL diff from the live DB to the edited schema
npx prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<ts>_<name>/migration.sql
# 2. ensure the file is BOM-free UTF-8 (PowerShell '>' writes a BOM; strip it)
# 3. apply + verify
npx prisma migrate deploy
npx prisma migrate status
```

## Production deployment checklist

1. Back up the database (standard procedure).
2. `npx prisma migrate deploy` (applies only `20260720110000_acctv2_foundation`).
3. `npx prisma migrate status` → up to date.
4. Verify legacy counts unchanged (any table sample) and 8 empty `AcctV2*` tables exist.
5. `npm run audit:forensic -- --module architecture` → no findings expected.
No application deployment coordination is required: no code path writes the new tables until
an administrator opts a tenant into shadow mode.
