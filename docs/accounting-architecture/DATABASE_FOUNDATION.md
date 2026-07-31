# Database Foundation

Migration: `prisma/migrations/20260720110000_acctv2_foundation/migration.sql` — 8 new tables,
purely additive (verified: only `CREATE TABLE`/`CREATE INDEX` plus FKs between the new tables).
No legacy table, column, or row is modified. `tenantId` columns are plain strings (no FK to
`Tenant`) so tenant deletion can never cascade into V2 accounting evidence — a deliberate
inversion of the legacy cascade-delete risk (R-17).

## Tables

| Table | Purpose | Key constraints |
|---|---|---|
| `AcctV2Configuration` | Per-business architecture config (base currency, architecture version, default posting mode, strict controls, shadow/integrity toggles) | `tenantId` unique |
| `AcctV2FeatureFlag` | Server-side flags scoped by tenant/module/eventType (sentinel `*`) | unique `(tenantId, flagKey, moduleKey, eventType)` |
| `AcctV2EventRegistry` | The accounting identity registry | **unique `idempotencyKey`**; **unique `(tenantId, sourceModule, sourceType, sourceId, eventType, eventVersion)`**; indexes on `(tenantId,status)`, `(tenantId,transactionDate)`, `(tenantId,sourceType,sourceId)`, `correlationId` |
| `AcctV2PostingAttempt` | Execution log per attempt (worker, duration, failure, retryability) | unique `(eventRegistryId, attemptNumber)`; FK Restrict |
| `AcctV2Outbox` | Transactional outbox | index `(status, occurredAt)` |
| `AcctV2ShadowJournal` | Isolated shadow proposals — never joined by production reports | FK Restrict to registry |
| `AcctV2ShadowJournalLine` | Shadow lines (Decimal 18,2) | FK Cascade (disposable analysis data, not accounting evidence) |
| `AcctV2ShadowComparison` | Legacy-vs-proposed result with per-account differences JSON | unique `shadowJournalId` |

## Design decisions

- **Money**: every V2 monetary column is `Decimal(18,2)` (`exchangeRate` `Decimal(18,8)`).
  No Float anywhere in V2 — answers R-14.
- **Identity uniqueness policy**: the tuple includes `eventType` and `eventVersion`, so
  legitimate multiple events per source (invoice posted + payment posted), reversals
  (`REVERSAL_POSTED`), adjustments, and versioned re-issues coexist while true duplicates are
  impossible. Amount is deliberately NOT part of identity. Partial workflows use registry
  `status`; failed registrations are reopened in place, not duplicated.
- **Architecture versioning**: `architectureVersion` on registry + shadow journals
  (`LEGACY_V1` / `TRANSITION_V2` / `ACCOUNTING_V2`) supports reconciliation and rollout.
- **Existing-data safety**: the unique constraints apply only to new (empty) tables, so the
  migration cannot fail on legacy duplicates. Legacy duplicate analysis stays a Phase 3/6
  prerequisite, recorded in `PHASE_3_READINESS.md`.

## Rollback

The foundation is independent of legacy behaviour; rollback = drop the 8 tables:

```sql
DROP TABLE IF EXISTS "AcctV2ShadowComparison", "AcctV2ShadowJournalLine",
  "AcctV2ShadowJournal", "AcctV2PostingAttempt", "AcctV2Outbox",
  "AcctV2EventRegistry", "AcctV2FeatureFlag", "AcctV2Configuration" CASCADE;
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260720110000_acctv2_foundation';
```

No legacy data is affected by applying or rolling back. See `MIGRATION_VALIDATION.md`.
