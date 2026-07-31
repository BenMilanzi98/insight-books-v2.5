# Phase 7 Readiness

Phase 7 (Trial Balance and financial-report reconstruction) can build on a
fully implemented, tested repair program with a measured anomaly baseline.

## Framework readiness — READY

- Anomaly registry, detection, classification, evidence/confidence, approval,
  batches, idempotency, dry run, execution, verification, rollback, APIs,
  console, CLI, permissions: all implemented and test-covered (34 tests green).
- Canonical GL agrees with posted journal lines (Phase 5 reconciliation);
  repair verification enforces this after every batch.
- Exceptions are queryable (`/api/accounting-v2/repair/exceptions`) so Phase 7
  reports can display integrity warnings — a business with material open
  exceptions must NOT receive an unqualified "accurate" status.

## Data readiness by business (dev dataset, detection of 2026-07-20)

| Business | Status | Detail |
|---|---|---|
| QA-Accounting tenant | Repairable with plan | 8 anomalies: 2 STORED_BALANCE_DIFFERENCE (accounts 3102, 1110), 2 UNSUPPORTED_HISTORICAL_RECORD (header-only capital journals), 4 TECHNICAL_LINKAGE_ERROR (missing period links). Repair plan documented; execution awaits finance approval per workflow. |
| All other tenants | Clean | No anomalies detected. |

## Residual-risk checklist for Phase 7

- Unbalanced journals remaining: 0 detected.
- Duplicate authoritative journals: 0 active pairs detected.
- Unsupported balances: 2 (the capital/stored-balance pair above), root cause
  proven, repair classes assigned — resolve or accept as exceptions before
  issuing unqualified equity reports for that tenant.
- Cross-business anomalies: 0.
- AR / AP / inventory / payroll / asset / loan / tax differences: none
  detected.
- Capital discrepancy: mechanism proven (stored balance + header-only
  journals); resolution path documented in
  `OWNER_CAPITAL_DISCREPANCY_REPAIR.md`.
- Ledger reconciliation: green outside the findings above.
- Account mappings: Phase 3 registry in force; salary 5200 canonical.
- Period coverage: 4 journals need period-link metadata repairs (LOW risk).

## Phase 7 requirements from Phase 6

1. Trial Balance must read ONLY canonical posted journal lines (authority
   rules), never stored balance fields.
2. Reports must consume the exception register and qualify affected
   businesses/periods.
3. Repair journals (`entryType: 'HistoricalRepair'`, HREP-) must be included in
   balances and identifiable in drill-downs.
4. Reversal pairs must net per the Phase 5 GL treatment.
