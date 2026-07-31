# Period Re-closing

A REOPENED period returns to CLOSED only through a full new close run.

## Mechanics

- `beginPeriodClose` on a REOPENED period creates a run with
  `closeNumber + 1` and `closeVersion + 1` and transitions the period to
  CLOSING (`BEGIN_RECLOSE` action in history).
- The complete checklist re-executes: fresh Trial Balance validation, GL
  reconciliation, report generation and manual reviews of the corrections.
- Review + approval follow the same separation-of-duties rules.
- `closePeriod` closes atomically and generates **new** snapshots; the
  original run remains `SUPERSEDED` and the original snapshots remain
  readable.

## Permanent record

For a period closed, reopened and re-closed, the database permanently holds:
the original COMPLETED→SUPERSEDED run with its tasks and evidence, the
approved reopen request with impact analysis, the new COMPLETED run, both
snapshot generations, and the full status-history chain
(CLOSE → REQUEST_REOPEN → APPROVE_REOPEN → BEGIN_RECLOSE → RECLOSE).
Covered by the "re-closes with a new run version, superseding but preserving
the original" test.
