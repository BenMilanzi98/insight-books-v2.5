# Report Status and Approval

## Integrity statuses (computed, per generation)

| Status | Meaning |
| --- | --- |
| VERIFIED | Equations pass, no material unmapped accounts, no blocking findings |
| VERIFIED_WITH_WARNINGS | Core equations pass; non-blocking exceptions remain (assisted mappings, open historical exceptions) |
| UNVERIFIED | A blocking equation/reconciliation failure or material unmapped balance exists |
| BLOCKED | Required data/configuration prevents reliable generation (e.g. GL-113) |

VERIFIED additionally requires drill-down reconciliation (sampled by the
reconciliation service) and a cache that agrees with the canonical query
(REP-030 checks).

## Workflow statuses (per run, `AcctV2ReportRun`)

GENERATED → REVIEWED → APPROVED → SUPERSEDED, implemented in
`reportRunService.js` and exposed at
`POST /api/accounting-v2/reports/runs/[id]` (actions `review`, `approve`,
`snapshot`).

- `reviewReportRun` — only GENERATED runs; records reviewer, time, comment.
- `approveReportRun` — only REVIEWED runs; **refuses** runs whose integrity is
  UNVERIFIED/BLOCKED or whose Trial Balance status is UNBALANCED/BLOCKED. An
  unverified report can never be presented as a final approved statement
  (tested). Approval records approver, time, comment — and never alters
  accounting journals (metadata-only update).
- Superseding happens through snapshots: when a newer snapshot of the same
  scope is created, the prior run is marked SUPERSEDED with a reason.

Every run stores: prepared-by (generatedBy), reviewer, approver, dates,
comments, filters + hash, definition version, accounting data version,
integrity warnings, totals, result checksum, request/correlation ids —
the full audit trail for §50.
