# Phase 6 — Historical Accounting Data Reconciliation, Correction and Controlled Repair

Phase 6 implements a controlled historical repair program: anomalies are detected
into a permanent registry, classified, evidenced, approved, dry-run previewed,
executed idempotently through the Phase 4 posting engine, verified against
before/after snapshots and post-repair reconciliation, and signed off per business.

## Non‑negotiable rules

- No posted journal or line is ever deleted or silently rewritten.
- Every financial correction is a NEW journal (reversal / reclassification /
  adjustment / missing-journal) posted through the Phase 4 engine.
- Every repair is evidence-based, approved, business-scoped, idempotent and audited.
- Unsupported balances are never "fixed" by inventing journals — they become
  visible exceptions.

## Code map

| Area | Location |
|---|---|
| Repair vocabulary (anomaly types, repair classes, statuses, approval matrix) | `lib/accountingV2/repair/repairCatalogue.js` |
| Anomaly registry service | `lib/accountingV2/repair/anomalyRegistryService.js` |
| Detection service | `lib/accountingV2/repair/anomalyDetectionService.js` |
| Batch framework + snapshots | `lib/accountingV2/repair/repairBatchService.js` |
| Command contract, dry run, execution, metadata rollback | `lib/accountingV2/repair/repairExecutionService.js` |
| Post-repair verification | `lib/accountingV2/repair/repairVerificationService.js` |
| HISTORICAL_REPAIR posting template | `lib/accountingV2/templates/pilotTemplates.js` |
| Repair source validator | `lib/accountingV2/engine/sourceValidation.js` |
| APIs | `app/api/accounting-v2/repair/**` |
| Internal console | `app/system/accounting-repair` |
| CLI | `scripts/accounting-repair.mjs` (run with `node --import ./scripts/registerAliasLoader.mjs`) |
| Schema | `prisma/migrations/20260720210000_acctv2_repair/` |
| Tests | `test/accountingV2.repair.test.js` |

## Document index

Framework: `HISTORICAL_ANOMALY_REGISTRY.md`, `ANOMALY_CLASSIFICATION.md`,
`REPAIR_CLASSIFICATION.md`, `EVIDENCE_AND_CONFIDENCE_FRAMEWORK.md`,
`REPAIR_APPROVAL_WORKFLOW.md`, `REPAIR_BATCH_FRAMEWORK.md`, `REPAIR_IDEMPOTENCY.md`,
`DRY_RUN_ENGINE.md`, `REPAIR_ENGINE_ARCHITECTURE.md`, `REPAIR_API_AND_COMMANDS.md`.

Repair playbooks: `TECHNICAL_METADATA_REPAIRS.md`, `DUPLICATE_JOURNAL_REPAIR.md`,
`MISSING_JOURNAL_REPAIR.md`, `ORPHAN_JOURNAL_REPAIR.md`, `UNBALANCED_JOURNAL_REPAIR.md`,
`WRONG_ACCOUNT_REPAIR.md`, `WRONG_PERIOD_REPAIR.md`, `CROSS_BUSINESS_REPAIR.md`,
`DIMENSION_REPAIR.md`, `REVERSAL_REPAIR.md`, `OPENING_BALANCE_REPAIR.md`,
`OWNER_CAPITAL_DISCREPANCY_REPAIR.md`, `UNSUPPORTED_LIABILITY_REPAIR.md`,
`STORED_BALANCE_RECONCILIATION.md`, `LEGACY_V2_CONFLICT_REPAIR.md`,
`CLOSED_PERIOD_REPAIR_POLICY.md`.

Subledger reconciliation: `RECEIVABLES_RECONCILIATION.md`, `PAYABLES_RECONCILIATION.md`,
`INVENTORY_RECONCILIATION.md`, `PAYROLL_RECONCILIATION.md`, `FIXED_ASSET_RECONCILIATION.md`,
`LOAN_RECONCILIATION.md`, `TAX_RECONCILIATION.md`, `EQUITY_RECONCILIATION.md`.

Operations: `BACKUP_AND_RESTORE_VALIDATION.md`, `PRODUCTION_REPAIR_STRATEGY.md`,
`MIGRATION_VALIDATION.md`, `PERFORMANCE_VALIDATION.md`, `ROLLBACK_STRATEGY.md`,
`SECURITY_AND_PERMISSIONS.md`, `OBSERVABILITY_GUIDE.md`, `BUSINESS_SIGNOFF_GUIDE.md`.

Closure: `PHASE_1_TO_5_EVIDENCE_INDEX.md`, `PHASE_6_TASKS.md`, `RISK_REGISTER.md`,
`PHASE_7_READINESS.md`, `FINAL_PHASE_6_REPORT.md`.

Machine-readable artifacts (non-sensitive) live under `artifacts/accounting-repair/`.
