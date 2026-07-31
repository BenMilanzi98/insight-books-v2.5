# Background Jobs

`lib/accountingV2/periods/periodMonitoringService.js` →
`runPeriodMonitoring(db, context)`; surfaced through
`GET /api/accounting-v2/periods/integrity` and runnable from any scheduler
under the existing V2 job runner.

## Checks

- Calendar integrity audit (PER-101…110) findings.
- `MISSING_CURRENT_PERIOD` — no canonical period covers today.
- `NEXT_YEAR_MISSING` — current year ends within the reminder window and no
  successor year exists.
- `OVERDUE_OPEN_PERIOD` — periods still OPEN beyond the policy age.
- `STALLED_CLOSE_RUN` — active close runs without progress.
- `OVERDUE_RECLOSE` — REOPENED periods past their re-close deadline.
- Closed-period posting attempts (from the rejection audit log).

## Job properties

- **Business-scoped:** the context carries an explicit `businessId`; no
  cross-tenant scans.
- **Idempotent and read-only:** monitoring only reports findings — it never
  closes, reopens, or mutates periods (approved workflows are the only
  mutators).
- **Observable:** findings return codes + messages suitable for metrics and
  notifications.
- **Safe under multiple workers:** read-only queries; snapshot generation at
  close runs inside the closure transaction, not in jobs.
