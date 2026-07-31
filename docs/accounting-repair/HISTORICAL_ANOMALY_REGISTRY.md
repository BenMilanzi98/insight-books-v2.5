# Historical Accounting Anomaly Registry

Permanent, business-scoped registry of every detected historical accounting
anomaly. Model: `AcctV2HistoricalAnomaly` (+ `AcctV2RepairEvidence`,
`AcctV2RepairException`). Service: `lib/accountingV2/repair/anomalyRegistryService.js`.

## Identity and idempotent detection

Every finding carries a natural `detectionKey` (e.g. `GL-111:<accountId>`,
`P6-DUP-001:<sourceType>:<sourceId>`) unique per business
(`@@unique([tenantId, detectionKey])`). Re-running detection upserts: measured
values (`financialImpactMinor`, `actualCondition`, `metadata`) refresh, workflow
state (`status`, approvals, repair links) never regresses. Findings are never
deleted; resolved rows keep full history.

## Fields

Scope: `tenantId`, `financialYearLabel`, `accountingPeriodId`, `module`.
Target: `sourceType/sourceId`, `journalEntryId`, `journalLineId`, `transactionId`,
`accountId`, `relatedEntityType/Id`. Classification: `anomalyType`, `severity`,
`confidence`, `financialImpactMinor`, `currency`, `expectedCondition`,
`actualCondition`, `rootCause`. Workflow: `status`, `assignedTo`, `reviewedBy/At`,
`proposedRepairType`, `proposedRepairData`, `approvalStatus`, `approvedBy/At`,
`repairBatchId`, `repairedAt`, `verificationStatus`, `verifiedBy/At`,
`exceptionReason`.

## Status machine (`ANOMALY_TRANSITIONS` in the catalogue)

```
DETECTED → UNDER_INVESTIGATION | EVIDENCE_INCOMPLETE | READY_FOR_REVIEW | ACCEPTED_EXCEPTION
READY_FOR_REVIEW → APPROVED_FOR_REPAIR | REJECTED | UNDER_INVESTIGATION | ACCEPTED_EXCEPTION
APPROVED_FOR_REPAIR → REPAIR_SCHEDULED → REPAIRING → REPAIRED | REPAIR_FAILED
REPAIRED → VERIFIED | REPAIR_FAILED | ROLLED_BACK
```

Enforced properties:

- `VERIFIED` is reachable only from `REPAIRED`, and only the batch verification
  service (`verifyBatch`) sets it — after ledger rebuild, post-repair
  reconciliation and snapshot comparison pass. A repair alone never verifies.
- `REPAIRED` is set only inside the repair execution transaction (posting engine
  for journal repairs, metadata transaction otherwise) — an anomaly can never be
  marked repaired while the repair itself failed.
- Evidence (`AcctV2RepairEvidence`) is append-only.
- All reads/writes are scoped by `tenantId`; cross-business ids read as "not found".

## Detection sources

`runAnomalyDetection` persists findings from:

1. Phase 5 ledger reconciliation + journal integrity rules (JRN-1xx / GL-1xx →
   anomaly types via `RULE_TO_ANOMALY_TYPE`), confidence `CONFIRMED` (measured).
2. `P6-DUP-001` duplicate active postings per source (identical totals →
   `HIGH_CONFIDENCE`, differing totals → `MEDIUM_CONFIDENCE` — may be partials).
3. `P6-ORPH-001` posted journals with no source and no sourceless classification.
4. `P6-OPEN-001` multiple opening postings touching one account.
5. `P6-XTEN-001` journal lines referencing another tenant's account (`CONFIRMED`, `CRITICAL`).
6. `P6-PER-001` posted journals missing their accounting-period link.
