# Phase 6 — Backup and Restore Validation

A backup is valid only when a restore test passes. This restore test passed.

## Environment identification

| Item | Value |
| --- | --- |
| Environment | Development (Laragon, Windows; local PostgreSQL) |
| Database | `insightbooksmw` @ localhost:5432 |
| PostgreSQL | 18.4 (pg_dump/pg_restore 18.4) |
| Git commit | `5b59a68c9ac5a07ee90fb76adf6fdf17a6700de0` (branch `v2`) |
| App | insite_books 0.1.0, Next.js 15.5.15, Prisma 6.19.3, Node v24.11.0 |
| Migration version | 100 migrations applied, latest `20260720200000_acctv2_ledger`; `prisma migrate status` clean |
| Date | 2026-07-20 |
| Operator | Cursor agent (development validation) |

## Backup

| Item | Value |
| --- | --- |
| Command | `pg_dump -h localhost -p 5432 -U insightbooksmw -d insightbooksmw -F c -f artifacts/accounting-repair/backups/insightbooksmw_phase6_pre_repair.dump` |
| File | `artifacts/accounting-repair/backups/insightbooksmw_phase6_pre_repair.dump` |
| Size | 620,759 bytes |
| SHA-256 | `DFDE2A1362D2EB547E26271DAA4CCEB88D9A94E7F583F555DFE136F58624716F` |
| Duration | 6 s |
| Attachments | No file-attachment store exists in this dev environment (DB-only backup sufficient) |

## Restore test

| Item | Value |
| --- | --- |
| Target | Isolated database `insightbooksmw_p6restore` (created by superuser, owned by app role) |
| Command | `pg_restore -h localhost -p 5432 -U insightbooksmw -d insightbooksmw_p6restore --no-owner <dump>` |
| Duration | 17 s |
| Result | Exit 0 |

## Count comparison (source vs restored) — exact match

| Table | Source | Restored |
| --- | --- | --- |
| Tenant | 5 | 5 |
| Transaction | 19 | 19 |
| TransactionLine | 39 | 39 |
| JournalEntry | 6 | 6 |
| JournalEntryLine | 8 | 8 |
| Account | 540 | 540 |
| Invoice | 4 | 4 |
| Expense | 2 | 2 |
| AccountingPeriod | 7 | 7 |
| AuditLog | 15 | 15 |
| AcctV2EventRegistry | 0 | 0 |
| AcctV2LedgerBalance | 0 | 0 |

Integrity checks (Phase 5 reconciliation + integrity rules) are run against this
data as part of the Phase 6 detection stage; results are recorded in the
anomaly artifacts.

## Recovery / rollback procedure

1. Stop the application.
2. `pg_restore --clean --if-exists -h <host> -U <user> -d insightbooksmw <dump>`
   (measured recovery time on this dataset: under 1 minute; production times
   must be re-measured on production volume before any production repair).
3. Verify counts against this document and re-run `prisma migrate status`.
4. Restart and smoke-test login + GL summary.

## Production protections

- Repair execution APIs and the CLI refuse non-dry-run execution unless the
  batch is APPROVED and the caller holds `accountingRepair.execute`.
- The CLI additionally requires `--confirm-production` together with
  `ACCOUNTING_REPAIR_ALLOW_PRODUCTION=1` when `NODE_ENV=production`.
- Every executed batch stores its `backupReference` (this file + checksum) and
  refuses to run when it is absent.
