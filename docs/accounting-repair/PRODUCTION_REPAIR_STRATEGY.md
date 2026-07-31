# Production Repair Strategy

Staged rollout — never a platform-wide uncontrolled repair.

## Stages

**Stage 1 — Framework (COMPLETE).** Repair framework implemented; full
automated suite green on synthetic fixtures (registry, idempotency, dry run,
every repair class, rollback, security, multi-tenant).

**Stage 2 — Production-like detection (COMPLETE on dev copy).** Restored backup
validated (`BACKUP_AND_RESTORE_VALIDATION.md`); detection run across all
tenants; 8 anomalies registered (QA-Accounting); dry-run plans generated;
findings documented for finance review (capital + stored-balance docs).

**Stage 3 — Low-risk metadata repairs in staging.** Execute the four
`TECHNICAL_LINKAGE_ERROR` period-link repairs first; rebuild ledger; reconcile;
exercise metadata rollback once to prove it; compare snapshots.

**Stage 4 — One financial-repair category in staging.** The approved capital
mechanism repair (report-authority + any approved journal), full report
comparison (GL, Capital, Balance Sheet, Equity Statement), finance sign-off.

**Stage 5 — Production pilot.** One business, controlled maintenance window
(`checklist below`), immediate validation, 48h monitoring.

**Stage 6 — Rollout.** Business by business, category by category, in approval
matrix risk order (metadata → report-only → duplicates → reclassifications →
period/cross-business). Sign-off pack per business.

## Maintenance-window checklist (Stage 5+)

Before: notify authorized users; restrict affected postings; drain queues;
pause imports/webhooks touching the scope; final backup + checksum; BEFORE
snapshot; confirm rollback operator, monitoring, business/period scope and the
approved batch checksum.

During: per-action progress recorded on the batch; transactions stay
action-scoped; **stop on any unexpected snapshot difference or critical
failure — no automatic continuation** (a failed action halts the batch in
FAILED/PARTIALLY_COMPLETED).

After: rebuild affected ledger scope; run integrity checks; AFTER snapshot and
comparison; re-enable postings only after verification passes and approval is
recorded; monitor errors and accounting metrics.

## Production execution guards

- CLI: `--confirm-production` + `ACCOUNTING_REPAIR_ALLOW_PRODUCTION=1`.
- API: permission + approval + batch + backup-reference gates.
- Batch approval requires the validated backup reference and unchanged
  checksum — an unapproved or drifted batch cannot execute anywhere.
