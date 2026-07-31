# Migration Validation

## Schema migration

`prisma/migrations/20260720210000_acctv2_repair/migration.sql` creates six
tables: `AcctV2HistoricalAnomaly`, `AcctV2RepairEvidence`, `AcctV2RepairBatch`,
`AcctV2RepairAction`, `AcctV2RepairSnapshot`, `AcctV2RepairException`.

Properties verified:

- **Additive only** — no existing table, column, index or constraint is
  altered or dropped; deploy on the live dev database succeeded with zero
  changes to existing data (record counts identical before/after).
- **Business-scoped** — every table carries `tenantId` with composite indexes
  led by it.
- **Indexed** — status, type, severity, batch and identity lookups covered;
  unique constraints implement idempotency (`findingCode` per tenant, one
  action per `(tenantId, anomalyId, repairType, repairVersion)`, one snapshot
  per batch/phase, `batchNumber` per tenant).
- **Backward-compatible** — no existing code path reads the new tables;
  pre-Phase-6 application behavior is unchanged.
- **Reversible** — pure `DROP TABLE` rollback (documented in
  `ROLLBACK_STRATEGY.md`); no data transformation to unwind.

## Validation performed

- Deployed to the dev database (production-like restored copy validated
  separately per `BACKUP_AND_RESTORE_VALIDATION.md`).
- Prisma client regenerated; type checking and lint pass.
- Migration test group covers: empty database (detection runs, zero
  anomalies), populated database (8 anomalies found and idempotently re-found
  on rerun), duplicate legacy data fixtures, interrupted execution + resume
  (FAILED action retried to completion), rerun safety (byte-identical registry
  after second detection pass), partial batch handling.
