# Repair Batch Framework

`AcctV2RepairBatch` is the unit of review, approval, execution, verification and
sign-off. Service: `lib/accountingV2/repair/repairBatchService.js`.

Fields: `batchNumber` (`REP-<year>-NNNN`, unique per business), scope
(`tenantId`, `financialYearLabel`, `accountingPeriodId`), `repairCategory`,
`description`, `status`, `dryRun`, actor trail (`requestedBy`, `reviewedBy`,
`approvedBy/At`, `executedBy`, `verifiedBy`), `requestId`/`correlationId`,
timings, `recordCount`, expected vs actual debit/credit impact (BigInt minor
units), `backupReference`, `rollbackPlan`, `checksum`, `errorSummary`.

## Status machine (`BATCH_TRANSITIONS`)

```
DRAFT → ANALYZED → READY_FOR_REVIEW → APPROVED → SCHEDULED|EXECUTING
EXECUTING → COMPLETED | PARTIALLY_COMPLETED | FAILED
COMPLETED → VERIFYING → VERIFIED | FAILED
FAILED → EXECUTING (retry) | ROLLED_BACK
```

Rules enforced by `transitionBatch`:

- `READY_FOR_REVIEW` freezes the action set: checksum (SHA-256 over ordered
  action identities + command hashes) and record count are stamped.
- `APPROVED` requires: approver ≠ requester, a validated backup reference, and
  an unchanged checksum since review.
- `EXECUTING` stamps the executor and clears `dryRun`.
- Batches are strictly business-scoped; cross-business ids read as "not found".

## Snapshots

`captureSnapshot(db, ctx, batchId, 'BEFORE'|'AFTER')` captures a business-scoped
accounting snapshot from the canonical journal source: journal count (canonical
transactions + journal entries), line count, total debit/credit minor units and
per-account closing balances from the ledger summary, plus a SHA-256 checksum of
the snapshot body (reproducible reference). One snapshot per phase per batch;
verification compares the AFTER−BEFORE delta against the approved expected
impact and requires Δdebit = Δcredit.
