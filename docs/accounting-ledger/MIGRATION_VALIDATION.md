# Phase 5 Migration Validation

Migration: `prisma/migrations/20260720200000_acctv2_ledger/migration.sql`
Database: PostgreSQL `insightbooksmw` (localhost:5432). Validated 2026-07-20.

## Contents (strictly additive)

1. `JournalEntry` columns: `sourceNumber`, `reversalStatus`,
   `originalJournalId`, `reversedByJournalId`, `reversedAt`, `reversedById`;
   indexes on `originalJournalId`, `reversedByJournalId`,
   `(tenantId, entryType)`.
2. New table `AcctV2LedgerBalance` (versioned monthly summary projection) with
   unique cell index and tenant/account/version indexes.
3. Immutability triggers:
   - `je_block_posted_delete` — BEFORE DELETE on `JournalEntry`; blocks
     deleting any journal in the posted family (all architectures).
   - `je_v2_block_posted_update` — BEFORE UPDATE on `JournalEntry`; freezes
     financial columns of posted V2 journals and forbids status regression.
   - `jel_v2_block_posted_change` — BEFORE UPDATE OR DELETE on
     `JournalEntryLine`; freezes lines of posted V2 journals.

Legacy (`LEGACY_V1`) posted-journal UPDATE protection is intentionally not
enforced at the database level yet: the live account-merge flow remaps line
`accountId`s on legacy journals. Deferred to Phase 6 together with that flow.

## Deployment evidence

- `npx prisma migrate status` → "99 migrations found … Database schema is up
  to date!" (no drift, no pending migrations).
- No existing rows modified; columns are nullable, the table starts empty.

## Trigger validation (live database, scratch transaction rolled back)

A scripted check inserted a scratch posted V2 journal + line inside a
transaction and exercised each protection; all scratch data was rolled back:

| Operation | Result |
| --- | --- |
| DELETE posted journal | blocked (`ACCTV2_IMMUTABLE`) |
| UPDATE `totalDebit` on posted V2 journal | blocked (`ACCTV2_IMMUTABLE`) |
| Status regression Posted → Draft | blocked (`ACCTV2_IMMUTABLE`) |
| Notes annotation + reversal linkage + Posted → Reversed | allowed |
| UPDATE line amount on posted V2 journal | blocked (`ACCTV2_IMMUTABLE`) |
| DELETE line of posted V2 journal | blocked (`ACCTV2_IMMUTABLE`) |
| Scratch row persisted after rollback | no |

The scratch insert also confirmed the Phase 4 CHECK constraint
`je_v2_posted_requirements` fires: a posted V2 journal without `tenantId` was
rejected by the database itself.

## Functional validation

- Full V2 test run after migration: `accountingV2.ledger` (36),
  `accountingV2.postingEngine` (48), `accountingV2.boundaries` (10) — all
  passing.
- Production build (`npm run build`) succeeds with all Phase 5 routes and the
  GL V2 page compiled.

## Reversibility

Behavioral rollback: stop using the new routes/flags — no legacy path depends
on the new columns. Schema rollback: drop the three triggers/functions, the
projection table and the new columns; posted journal data is untouched by
design.
