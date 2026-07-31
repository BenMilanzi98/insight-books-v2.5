# Report Snapshots

`snapshotReport` in `reportRunService.js`; table `AcctV2ReportSnapshotV2`;
API action `snapshot` on `POST /api/accounting-v2/reports/runs/[id]`
(permission `reports.snapshot`).

## Contents

Each snapshot stores the **complete report envelope** as payload — definition
id + version, filters, mapped accounts per line, calculated lines, totals,
integrity status, warnings, unresolved exceptions, generation timestamp and
generator — plus a SHA-256 checksum of the payload and the
`accountingDataVersion` (a fingerprint of latest posting activity + counts)
current at snapshot time. Business, report type and period travel with the
run's filters.

## Immutability and supersession (REP-040)

Snapshots are never updated in place. When a new snapshot is created for the
same business/report/filters-hash scope:

1. The previous ACTIVE snapshot remains stored, marked SUPERSEDED with
   `supersededBySnapshotId` and the caller's reason.
2. The new snapshot gets `version = prior + 1`, status ACTIVE.
3. The superseded snapshot's run is marked SUPERSEDED.

So a historical adjustment produces a new version while the original issued
statement remains verifiable byte-for-byte via its checksum (integration
Scenario 10, tested).

## Intended use

Closed accounting periods, approved monthly/quarterly/annual statements, and
reports issued to banks, auditors or investors. Phase 8's period-closing
workflow will call snapshotting as part of the close checklist; the engine
side is complete.
