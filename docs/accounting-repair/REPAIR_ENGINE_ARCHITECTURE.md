# Repair Engine Architecture

All Phase 6 code lives in `lib/accountingV2/repair/`; financial journals post
exclusively through the Phase 4 engine (no parallel posting path was created).

## Modules

| Module | Responsibilities (maps to spec services) |
|---|---|
| `repairCatalogue.js` | Anomaly types, repair classes, confidence levels, status machines, approval matrix, rule mapping. |
| `anomalyRegistryService.js` | HistoricalAnomalyService + RepairEvidenceService + RepairApprovalService: record/list/get anomalies, transitions, evidence, proposals, decisions, exceptions. |
| `anomalyDetectionService.js` | Detection passes: Phase 5 reconciliation (GL/subledger/stored-balance/legacy-V2 rules) + P6 detectors (duplicate source postings, orphan journals, opening duplication, cross-tenant references, missing period links). Read-only except registry upserts. |
| `repairBatchService.js` | RepairBatchService + snapshot capture + checksums + batch state machine. |
| `repairExecutionService.js` | RepairPlanService + RepairDryRunService + RepairExecutionService + RepairIdempotencyService + RepairMetadataService + RepairRollbackService: strict command, hashing, dry run, atomic execution, metadata rollback. |
| `repairVerificationService.js` | RepairVerificationService + RepairReconciliationService: journal checks, ledger rebuild, post-repair reconciliation, snapshot comparison, verdict. |

Journal creation (RepairJournalService) = the Phase 4 posting engine with the
`HISTORICAL_REPAIR_POSTED` event type: template `HISTORICAL_REPAIR`
(`pilotTemplates.js`), source validator `repairActionSourceValidator`
(`sourceValidation.js`), `HREP-` numbering, always-approval, and atomic
source-state updates that stamp the action `COMPLETED` and anomaly `REPAIRED`
inside the posting transaction (`postingEngine.js`).

Audit (RepairAuditService) = the existing immutable accounting audit trail; all
repair operations log with request/correlation ids.

## Execution flow (one action)

```
buildRepairCommand (strict, validated)
→ claim identity (unique insert; replay/conflict/resume resolution)
→ [journal repairs]   postEvent via Phase 4 engine ── one DB transaction:
                      journal + lines + event registry + action COMPLETED
                      + anomaly REPAIRED + audit + outbox
→ [metadata repairs]  whitelist-checked update + previous values + action
                      + anomaly, one transaction
→ [projection/report] rebuild or documented code fix; action completed
→ failure at any point: transaction rolls back, action marked FAILED with
  sanitized error, anomaly stays unrepaired, retry safe
```

Supported operations: single-anomaly repair, batches, per-business / per-period
/ per-module scoping (batch fields + filters), dry run, execute, pause/resume
(idempotent identity + batch retry transition), verify, metadata rollback,
export (JSON APIs/CLI), exception handling.

## Performance posture

Detection paginates journal scans; execution is one scoped transaction per
action (never one platform-wide transaction); ledger rebuilds are
business-scoped; batches record per-action progress enabling resume; conflicting
concurrent execution on the same identity is rejected by the unique constraint.
