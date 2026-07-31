# Rollback Strategy

Every repair class has a defined rollback BEFORE approval (the dry-run preview
includes it; batch approval requires a `rollbackPlan`).

| Repair class | Rollback |
|---|---|
| Metadata / source-status / source-link | `rollbackMetadataRepair`: restores the stored `previousValues`, marks the action `ROLLED_BACK` (who/when), anomaly → `ROLLED_BACK`. Exact-restore is test-covered and exposed via API (`rollback-action`) under `accountingRepair.rollback`. |
| Journal-creating repairs (reversal, reclassification, adjustment, missing journal, duplicate effect, period, cross-business) | The repair journal is **never deleted**. Rollback = an authorized reversal OF the repair journal (a new anomaly/action with its own approval), restoring the prior net effect while preserving the full history chain. |
| Projection rebuild | Rebuild again from canonical journals (the projection is always derivable; there is no state to lose). |
| Report-only repair | Revert the code deployment; journals were never touched. |
| Source-status repair | Restore the previous status via the stored previous values, provided no conflicting financial effect was created since. |
| Schema (Phase 6 tables) | `DROP TABLE` the six `AcctV2Repair*`/anomaly tables; no existing data was transformed. |
| Full database restore | Last resort for broad batch failure, using the validated backup + restore procedure in `BACKUP_AND_RESTORE_VALIDATION.md` (restore test passed; RTO documented there). Requires operational approval; loses all writes since backup. |

## Validation performed

- Metadata rollback: executed in tests — fields restored byte-exact, action and
  anomaly statuses correct, audit written.
- Transaction rollback: injected failures during journal creation, source
  update and status stamping leave zero partial state (journal absent, action
  FAILED, anomaly unrepaired) and retry succeeds — test-covered.
- Database restore: full backup restored to an isolated database, record counts
  matched source, integrity checks passed (see backup validation doc).
