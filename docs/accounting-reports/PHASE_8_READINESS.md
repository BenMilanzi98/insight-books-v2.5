# Phase 8 Readiness — Financial Calendar and Accounting Periods

Phase 8 will implement the full financial calendar and period-closing
workflow. The reporting engine already provides everything it needs.

## Available now

- **Period-specific reports** — every generator accepts arbitrary
  from/to/as-of windows; Phase 8 supplies canonical period boundaries and the
  engine reports on them unchanged (`financialYearId`/`accountingPeriodId`
  are already on the request contract and stored with runs).
- **Trial Balance status for close checklists** — BALANCED /
  BALANCED_WITH_WARNINGS / UNBALANCED / BLOCKED per window, with exact
  differences and affected accounts; a close can gate on it directly.
- **Report-generation status** — `AcctV2ReportRun` records what was
  generated, reviewed and approved per scope; the closing checklist reads it.
- **Snapshots for closed periods** — immutable, versioned, supersession with
  reason; period close calls `snapshotReport` for TB + statements and the
  closed period is preserved (REP-040).
- **Closed-period protection** — regenerating after a reopening produces a
  new snapshot version while the old one survives; Phase 8 adds the policy
  layer (who may reopen, mandatory re-close).
- **Period comparisons** — comparative windows already enforce equivalent
  scopes.
- **Module statuses** — receivables/payables/inventory/payroll/tax control
  reconciliation results feed the closing checklist (bank reconciliation
  status arrives with the Bank Reconciliation module).

## Phase 8 must add

Period entities and status transitions (OPEN → CLOSING → CLOSED → REOPENED),
posting locks per period (posting-engine guard), the closing checklist UI
wiring to run/snapshot records, year-end closing entries (Phase 12 scope
overlap: retained-earnings posting), and reopening governance. No reporting
engine changes are anticipated — the engine's inputs (windows) and outputs
(statuses, runs, snapshots) were designed for it.
