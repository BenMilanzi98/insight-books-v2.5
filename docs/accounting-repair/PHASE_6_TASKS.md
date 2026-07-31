# Phase 6 Implementation Plan — Historical Reconciliation, Correction and Controlled Repair

Status values: PLANNED / IN_PROGRESS / COMPLETE / DEFERRED.
Standing constraints for every workstream: posted journals are never edited or
deleted (DB triggers enforce this for V2; policy + engine guards for legacy);
every financial repair flows through the Phase 4 posting engine; every repair
is evidence-based, approved, idempotent, audited and business-scoped.

| WS | Workstream | Status | Depends | Files / evidence | Repair type(s) | Approval | Rollback | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | Previous-phase evidence review | COMPLETE | — | `PHASE_1_TO_5_EVIDENCE_INDEX.md` | — | — | — | 20 evidence entries, all citing real prior docs |
| B | Environment safety | COMPLETE | — | `BACKUP_AND_RESTORE_VALIDATION.md` | — | — | — | Dev env identified; git/migration/app versions recorded |
| C | Backup + restore validation | COMPLETE | B | same; `artifacts/accounting-repair/backups/` | — | — | Documented restore procedure | Restore test passed; counts match exactly |
| D | Historical anomaly registry | COMPLETE | A | `prisma/schema.prisma` (`AcctV2HistoricalAnomaly`), migration | — | — | Additive schema | Full field set + status machine |
| E | Repair classification framework | COMPLETE | D | `lib/accountingV2/repair/repairCatalogue.js` | all 12 classes | per matrix | — | Anomaly types + permitted repairs + approval matrix |
| F | Evidence + confidence framework | COMPLETE | E | same + `AcctV2RepairEvidence` | — | — | — | CONFIRMED…UNSUPPORTED; auto-repair gates |
| G | Repair approval workflow | COMPLETE | E | registry service + action statuses | — | separation of duties | — | Executor ≠ approver for high-risk |
| H | Dry-run engine | COMPLETE | I | `repairDryRunService` via execution service `dryRun` | — | — | — | No mutation; full impact preview; tested |
| I | Repair batch framework | COMPLETE | D | `AcctV2RepairBatch` + `repairBatchService.js` | — | — | Batch status machine | Business-scoped; checksum; snapshots |
| J | Repair idempotency | COMPLETE | I | `AcctV2RepairAction` unique key + command hash | — | — | — | `(tenantId, anomalyId, repairType, repairVersion)` unique; replay-safe |
| K | Technical metadata repairs | COMPLETE | J | `repairExecutionService.js` METADATA_ONLY path | METADATA_ONLY / SOURCE_LINK / SOURCE_STATUS | senior accountant | previous values stored; rollback action | Field whitelist; financial fields rejected |
| L | Duplicate-journal correction | COMPLETE | J | detection + HISTORICAL_REPAIR reversal template | DUPLICATE_EFFECT_REPAIR | Finance Manager | reverse-the-repair journal | Authoritative journal preserved |
| M | Missing-journal correction | COMPLETE | J | HISTORICAL_REPAIR posting via engine | MISSING_JOURNAL_REPAIR | Finance Manager | reversal of repair journal | Source evidence validated; `posted` flag alone insufficient |
| N | Orphan-journal correction | COMPLETE | J | classification + SOURCE_LINK / reversal | SOURCE_LINK_REPAIR / REVERSAL_REPAIR | per matrix | — | Proven links only |
| O | Wrong-account correction | COMPLETE | J | reclassification template path | RECLASSIFICATION_REPAIR | Finance Manager | reverse reclass journal | Original journal untouched |
| P | Wrong-period correction | COMPLETE | J | reversal + repost flow; policy doc | PERIOD_ADJUSTMENT_REPAIR | FM + period controller | reverse pair | No direct period mutation |
| Q | Wrong-business correction | COMPLETE | J | cross-business flow (reverse + repost + incident) | CROSS_BUSINESS_REPAIR | FM + Super Admin | reverse pair | No businessId mutation; security incident recorded |
| R | Wrong-dimension correction | COMPLETE | K | metadata path (non-financial) / reclass (subledger) | METADATA / RECLASSIFICATION | per matrix | previous values stored | |
| S | Unbalanced-journal resolution | COMPLETE | J | detection (JRN-102) + evidence-based treatments | per root cause | Finance Manager | — | No blind balancing lines; unresolved → exception |
| T | Reversal correction | COMPLETE | J | Phase 5 linkage columns + metadata/reversal repairs | REVERSAL_REPAIR / METADATA | Finance Manager | — | |
| U | Opening-balance correction | COMPLETE | J | OB duplicate detection + reversal | DUPLICATE_EFFECT_REPAIR | Finance Manager | — | Authoritative batch preserved |
| V | Capital-account correction | COMPLETE | forensics | `OWNER_CAPITAL_DISCREPANCY_REPAIR.md` | per proven mechanism | FM + owner | — | Dev-data investigation complete; mechanism-specific repairs |
| W | Unsupported-liability correction | COMPLETE | forensics | `UNSUPPORTED_LIABILITY_REPAIR.md` | evidence-based / exception | Finance Manager | — | No invented journals |
| X | Stored-balance reconciliation | COMPLETE | detection | GL-111 detection → registry; cache retirement policy | PROJECTION_REBUILD / REPORT_ONLY | senior accountant | rebuild | Canonical journals stay authoritative |
| Y | Legacy/V2 conflict resolution | COMPLETE | detection | GL-117 detection → DUPLICATE_EFFECT_REPAIR | DUPLICATE_EFFECT_REPAIR | Finance Manager | — | Authority per Phase 5 rules |
| Z–AG | Subledger reconciliations (AR, AP, inventory, payroll, assets, loans, tax, equity) | COMPLETE | detection | `MODULE_RECONCILIATIONS` docs + detection rules | evidence-based | per matrix | — | Control-vs-subledger comparisons; exceptions documented |
| AH | Ledger rebuild after repair | COMPLETE | Phase 5 | `ledgerRebuildService` invoked post-batch | PROJECTION_REBUILD | — | versioned projection | |
| AI | Post-repair integrity checks | COMPLETE | AH | `repairVerificationService.js` | — | — | — | Batch not verified unless reconciliation passes |
| AJ | Exception management | COMPLETE | D | `AcctV2RepairException` + service + API | — | finance decision | — | Exceptions stay visible to Phase 7 |
| AK | UI and API | COMPLETE | all | `/api/accounting-v2/repair/*`, `app/system/accounting-repair/page.js` | — | — | — | No raw SQL, no debit/credit editing |
| AL | Permissions + audit | COMPLETE | AK | `accountingRepair.*` permissions; immutable audit records | — | — | — | Separation of duties enforced server-side |
| AM | Testing | COMPLETE | all | `test/accountingV2.repair.test.js` | — | — | — | Registry, idempotency, dry-run, repairs, security, rollback |
| AN | Production migration strategy | COMPLETE | C | `PRODUCTION_REPAIR_STRATEGY.md` | — | — | `ROLLBACK_STRATEGY.md` | Staged; pilot business; maintenance window |
| AO | Business sign-off | COMPLETE | AI | `BUSINESS_SIGNOFF_GUIDE.md` + generator | — | finance + auditor | — | Pack per business; dev-data packs generated |
| AP | Phase 7 readiness | COMPLETE | all | `PHASE_7_READINESS.md` | — | — | — | Per-business repair status |
| AQ | Final report | COMPLETE | all | `FINAL_PHASE_6_REPORT.md` | — | — | — | |

## Financial scope of this development pass

All five development tenants, all periods (2025–2026 financial years).
Expected financial impact of the development pass: **zero posted-amount
changes** — detection, registry population, dry-runs, metadata-class findings
and report/projection-class repairs only; financial repair journals in dev are
exercised through the automated test suite. Production execution follows
`PRODUCTION_REPAIR_STRATEGY.md` stage gates with real finance approval.
