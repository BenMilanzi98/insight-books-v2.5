# Report Definition Framework

`lib/accountingV2/reporting/reportDefinitions.js`.

## Versioned, immutable definitions

Definitions are frozen (`Object.freeze`, including every line) published
templates keyed by report type and semantic version:

- `IS-STANDARD` 1.0.0 — Income Statement (period activity)
- `BS-STANDARD` 1.0.0 — Statement of Financial Position (as-of cumulative)
- `CF-INDIRECT` 1.0.0 — Cash Flow, indirect method (default approved method)
- `EQ-CHANGES` 1.0.0 — Statement of Changes in Equity

Each definition records id, reportType, name, version, scope (`TEMPLATE` —
usable by every business; business-scoped overrides are additive future
work), status (`PUBLISHED`), basis, and lines. Published definitions cannot be
mutated; a change requires a new version. Report runs and snapshots store the
definition version used (`definitionVersion` on `AcctV2ReportRun` /
`AcctV2ReportSnapshotV2`), so historical reports retain their version and
regeneration with the same version is exact.

`getReportDefinition(reportType, version)` resolves a specific version or the
latest published one; unknown versions throw (REP-039 cannot occur silently).

## Line types

The controlled list lives in `reportContracts.js` (REPORT_LINE_TYPES);
`buildReportLine` rejects anything else. Definitions contain no executable
code: calculated lines use `formula` arrays of `{op: '+'|'-', ref: lineId}`
evaluated by `evaluateFormula`, which rejects unknown operations and unknown
line references (tested).

## Administration

Definitions ship in code and are versioned through source control and review —
ordinary users cannot alter report calculations. A read-only admin surface
(`/system/accounting-reporting`) for browsing definitions, versions, mappings
and unmapped accounts is deferred work; the unmapped-account report is already
served by `GET /api/accounting-v2/reports/reconciliation`.
