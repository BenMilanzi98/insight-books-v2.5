# Migration Validation

## Schema change

One additive migration: `prisma/migrations/20260720220000_acctv2_reporting/`
creating `AcctV2ReportRun`, `AcctV2ReportSnapshotV2` and `AcctV2ReportCache`.
Properties: additive only (no existing table touched), business-scoped
(`tenantId` on every table), versioned (definition + data versions stored),
indexed, backward-compatible (legacy reporting unaffected), reversible (drop
the three tables — no accounting data lives in them; snapshots are derived
artifacts).

Apply with `npx prisma migrate deploy`; rollback by dropping the three tables
and reverting the schema.

## Data migration

None required. The engine reads existing canonical data (legacy posted
transactions + V2 journals) through the Phase 5 authority rules — no backfill,
no rewrite of any posted journal.

## Validation coverage (suite: `test/accountingV2.reports.test.js`)

- Empty database: every report type generates cleanly with zero totals and no
  spurious findings.
- Legacy-only data, V2-only data and mixed architecture (mirror exclusion:
  the MK1,000,000 capital fixture with its legacy mirror counted once).
- Missing mappings: unclassified accounts → REP-036 disclosure + UNVERIFIED,
  never silent exclusion.
- Duplicate-mapping prevention: single-assignment engine + REP-013/037 scans.
- Rerun safety: report generation is read-only and deterministic — identical
  requests produce identical checksums; cache rebuild is idempotent.
- Interrupted generation leaves no partial accounting state (only a run row,
  harmless and auditable).
- Two-tenant datasets validate isolation through migration-shaped data.

Large-volume validation on production-like PostgreSQL data is the Stage 2
rollout gate (see CONTROLLED_ROLLOUT.md).
