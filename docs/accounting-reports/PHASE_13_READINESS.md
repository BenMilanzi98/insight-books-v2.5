# Phase 13 Readiness — Financial Planning and Projections

Phase 13 (planning, projections, lender-readiness) consumes historical
financial data. The reporting engine now supplies it canonically.

## Available inputs

- **Closed-period statements** — Income Statement, Balance Sheet, Cash Flow
  and Equity Statement per window, plus immutable verified snapshots for
  periods issued to lenders (checksummed, versioned, integrity-stamped).
- **Trend series** — revenue/expense trends are repeated Income Statement
  windows (monthly/quarterly); the engine is deterministic, so series are
  reproducible.
- **Working capital, receivables, payables, inventory, debt, equity, cash** —
  Balance Sheet lines and module reports per as-of date; the KPI service
  already computes working capital, current ratio and debt-to-equity.
- **Budget baseline** — Budget versus Actual foundation supplies
  actual/budget/variance per account for projection calibration.
- **Comparatives and ratios** — equivalent-scope comparisons and ratio lines
  are contract features.
- **Integrity signals** — every input carries an integrity status, so the
  planning module can weight or exclude UNVERIFIED periods.

## Data-quality blockers to watch

1. Open Phase 6 historical exceptions keep affected periods
   UNVERIFIED/with-warnings — projections built on them must disclose it
   (statuses make this mechanical).
2. Until Phase 8 closes periods formally, "closed-period" statements are
   date-window statements with snapshots rather than locked periods.
3. Dimension-level projections (per project/department) wait on dimensional
   capture (see DIMENSIONAL_REPORTING.md).
4. Businesses still on legacy reports have no canonical history until their
   cutover — rollout order matters for planning adoption.

No engine changes are required for Phase 13 to start; it builds on the report
API and snapshot store.
