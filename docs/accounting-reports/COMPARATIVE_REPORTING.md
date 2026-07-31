# Comparative Reporting

## Contract-level guarantees

- A comparative request supplies `comparisonFromDate`/`comparisonToDate`
  (period reports) or `comparisonAsOfDate` (position reports).
- **Equivalent scopes are enforced**: a period report with an incomplete
  comparative period is rejected at `normalizeReportRequest` (tested), and
  `validateEnvelope` raises REP-035 if an envelope carries a period scope with
  a non-period comparative. An as-of Balance Sheet compares to another as-of
  date, never to period activity.
- Currencies are not mixed: comparatives run in the same business base
  currency as the current column.

## Output

Each line carries `comparativeAmount`, `varianceAmount` and
`variancePercentage` (null-safe when the comparative is zero). The Trial
Balance adds a per-account `comparativeClosing`. Supported comparisons are
whatever equivalent windows the caller supplies: month vs previous month,
quarter vs quarter, same period last year, year vs year; Actual vs Budget
comes from the Budget versus Actual report. Branch-versus-branch comparison is
two requests with different `branchId` values over identical windows.

## Tested

Income Statement June-vs-July comparative (variance 100,000 on revenue),
Balance Sheet as-of comparatives (July vs June cash), Trial Balance
comparative closing columns, and rejection of incomplete comparative periods.

Comparative drill-down preserves the comparative scope through the same
drill-down engine (the envelope's `comparisonScope` travels with it).
