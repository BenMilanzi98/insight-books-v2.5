# Migration Validation

## Database migration

`prisma/migrations/20260721080000_acctv2_financial_calendar/migration.sql` —
purely additive: eight new `AcctV2*` tables with FKs, uniques and indexes.
No existing table is altered; the legacy `AccountingPeriod` table and all
journal data are untouched. Reversible while no dependent rows exist.

Apply with `npx prisma migrate deploy`; verify with `npx prisma migrate status`.

## Legacy data migration validation

1. **Preview first** — `{action: 'preview'}` reports legacy inventory,
   overlaps/gaps and unassigned journal counts without writing.
2. **Execute** — creates canonical years/periods, aliases legacy rows,
   assigns journals from posting dates only where unambiguous.
3. **Post-checks:**
   - `assertMigrationComplete` — zero posted journals without canonical
     period reference (blocks strict flags otherwise).
   - `runCalendarIntegrityAudit` — PASS on the canonical calendar.
   - Trial Balance / GL reconciliation (Phase 5/7 services) before vs after —
     totals must be identical, because migration never modifies amounts or
     dates.
   - Audit record `acctv2.period.legacyMigration` present per batch.
4. **Idempotency** — re-running execute creates nothing new and reassigns
   nothing (covered by the migration idempotency test).

Tested scenarios: empty database, legacy overlapping periods, journals
without periods, closed-status carry-over, dateless journals left as
exceptions, rerun.
