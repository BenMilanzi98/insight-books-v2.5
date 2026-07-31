# FINAL PHASE 7 REPORT — Trial Balance and Financial Reporting Engine

Date: 2026-07-20 · Status: **COMPLETE** (code, tests, docs; production-data
validation is the Stage 2 rollout gate)

## 1. Executive summary

Phase 7 replaces the dual-stack legacy reporting system (GL-backed screens
mixed with operational/stored-balance calculations) with **one centralized
Financial Reporting Engine** whose only financial data source is the
canonical General Ledger built in Phase 5. Every formal report — Trial
Balance, Income Statement, Balance Sheet, Cash Flow, Statement of Changes in
Equity, receivables/payables aging, module reports and Budget vs Actual —
flows through a single facade with shared contracts, mapping, aggregation,
validation, drill-down, caching, exports and audit. Reports disclose
discrepancies exactly and never plug, hide or auto-correct them.

## 2. Previous-phase evidence reviewed

Indexed in PHASE_1_TO_6_EVIDENCE_INDEX.md: Phase 1 forensic findings (report
lineage, TB forensics, duplicate postings, capital duplication), Phase 2
architecture and authority rules, Phase 3 CoA reconstruction and
financial-statement mappings, Phase 4 posting engine guarantees, Phase 5 GL
Query Service contract, Phase 6 repair framework and the open exception
register (which the reporting engine discloses on every envelope).

## 3. Existing reporting defects

Mapped in CURRENT_REPORTING_ARCHITECTURE.md: two parallel calculation stacks;
financial statements reading operational tables and stored balances;
dashboards computing independently; retired aging APIs; inconsistent
period/date handling; exports recomputing values; no drill-down or integrity
statuses.

## 4. Target architecture

Canonical Posted Journal Entry Lines → General Ledger Query Service → Trial
Balance Engine → Financial Statement Mapping Engine → Reports → Drill-down →
Exports. See TARGET_REPORTING_ARCHITECTURE.md.

## 5. Database changes

One additive migration (`20260720220000_acctv2_reporting`): `AcctV2ReportRun`
(runs, review/approval audit), `AcctV2ReportSnapshotV2` (immutable versioned
snapshots), `AcctV2ReportCache` (rebuildable, version-fingerprinted cache).
Tenant-scoped, indexed, reversible. No accounting table was modified; no
journal was changed; no balancing journal exists anywhere in the engine.

## 6–12. Engine, Trial Balance, definitions, mappings, aggregation, hierarchy

- Facade: `financialReportService.js` (`generateReport`) — single entry point
  for 14 report types, with caching and run recording.
- Contracts: `reportContracts.js` — normalized validated requests, request
  hashing, minor-unit exact arithmetic, controlled line types, standard
  envelope.
- Trial Balance: `trialBalanceService.js` — per-account opening/period/closing
  debits and credits from canonical lines only; three equations (opening,
  period, closing); statuses BALANCED / BALANCED_WITH_WARNINGS / UNBALANCED /
  BLOCKED; open Phase 6 exceptions disclosed; no stored balance read.
- Definitions: `reportDefinitions.js` — versioned immutable definitions
  (IS-STANDARD, BS-STANDARD, CF-INDIRECT, EQ-CHANGES, all 1.0.0), declarative
  account matching (explicit CoA V2 classification first, name assists
  flagged), single-assignment engine preventing double counting, controlled
  formulas only.
- Hierarchy: posting accounts contribute once; header/parent totals derive
  from children; aliases and legacy mirrors excluded by authority rules.

## 13–16. Financial statements

Income Statement (period activity, Gross Profit/EBITDA/Operating
Profit/PBT/Net Profit, capital/loan-proceeds/drawings structurally excluded);
Balance Sheet (cumulative as-of balances, CYE calculated once from P&L, RE
split posted vs calculated, equation enforced with exact difference
disclosure); Cash Flow (indirect method, operating/investing/financing, both
cash equations, no plug); Equity Statement (equity journal lines only,
reconciles to BS equity). Per-statement docs carry the details and fixture
figures.

## 17–25. Subledger, budget, comparatives, dimensions, currency

AR/AP aging (operational detail, GL control reconciliation, REP-006/007
variance disclosure); Inventory/Fixed Asset/Payroll/Loan/Tax/Equity module
reports read GL accounts directly; Budget vs Actual foundation (GL actuals vs
separate budget model, never posted); comparatives enforce equivalent scopes;
branch dimension end-to-end with UNASSIGNED disclosure for missing
dimensions; statements in base currency with currency-filtered detail.

## 29–35. Drill-down, integrity, statuses, approval, snapshots, cache

Drill-down (line → accounts → GL activity → journal lines → sources) with the
REP-025 sum-to-source guarantee and explicit PERIOD/AS_OF basis; the
REP-001..REP-040 validation catalogue (`reportValidationService.js`) plus the
independent reconciliation service; unmapped-account report with VERIFIED
blocking; integrity statuses VERIFIED / VERIFIED_WITH_WARNINGS / UNVERIFIED /
BLOCKED; workflow GENERATED → REVIEWED → APPROVED → SUPERSEDED with
unverified-approval refusal; immutable versioned snapshots with supersession
reasons; read-through cache with data-version freshness and REP-030
reconciliation.

## 36–42. APIs, UI, exports, dashboard, security, audit

Nine secured routes under `/api/accounting-v2/reports/*`; `/reports-v2`
workspace (categories, integrity badges, account expansion, drill-down modal,
exports); CSV/Excel/PDF render the same completed envelope (numeric cells,
formula-injection sanitization, warnings always printed); canonical dashboard
KPI service; 19 new report permissions with payroll/equity restriction and
separation of duties; full audit logging with request/correlation ids.

## 43–45. Tests, migration, performance

`test/accountingV2.reports.test.js`: **57 tests, all passing** — contracts,
TB (balance, exclusions, mirror authority, comparatives), all four
statements, subledgers, budget, drill-down (period + as-of bases,
cross-business rejection), validation rules, unmapped control, runs/approval
gating, snapshots/supersession, cache lifecycle/reconciliation, exports
(consistency + injection), KPI alignment, multi-tenant isolation, empty
database. Migration validation and performance design/benchmark plan are
documented; production-data benchmarking is the Stage 2 gate.

## 46. Remaining accounting exceptions

The Phase 6 exception register remains authoritative. Open exceptions are
disclosed on every affected envelope and cap integrity at
VERIFIED_WITH_WARNINGS (or UNVERIFIED where blocking). Nothing was hidden or
plugged.

## 47–49. Rollout and readiness

Eight-stage flag-controlled rollout with per-business cutover conditions and
a non-destructive rollback (CONTROLLED_ROLLOUT.md, ROLLBACK_STRATEGY.md);
Phase 8 and Phase 13 readiness documented with concrete integration points.

## 50–56. Confirmations

1. **All formal reports derive from the General Ledger** — the statement
   generators read only `getBusinessLedgerSummary` / canonical totals;
   operational data appears solely as aging detail reconciled to controls.
2. **Account codes and names appear on report details** — every populated
   line carries `accountCodes`/`accountNames` and expands to per-account
   rows (REP-024 enforced).
3. **Every figure supports drill-down** — line → accounts → GL → journals,
   sum-verified (REP-025).
4. **Parent and child accounts are not double-counted** — single-assignment
   mapping plus REP-013 runtime scan, tested.
5. **Owner capital is not duplicated** — the MK1,000,000 fixture appears
   exactly once across TB, BS, equity statement and module report, tested.
6. **No unsupported balancing entry was created** — the engine is read-only;
   imbalances are disclosed with exact differences.
7. **Screen and exports use identical calculation services** — CSV, Excel
   and PDF render the same completed envelope; equality is tested.
