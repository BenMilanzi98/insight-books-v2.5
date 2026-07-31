# Current Financial Calendar Architecture (pre-Phase 8)

Inventory of everything that resolves, validates or transitions accounting
periods today. Two stacks coexist: the legacy period stack and the Phase 4
engine resolver layered over the same legacy table.

## Data model

- **`AccountingPeriod`** (only period table): `tenantId`, `name`,
  `periodType` (`Monthly` | `Yearly`), `startDate`, `endDate`,
  `status` (`open` | `closed` — plus ad-hoc `reopened` writes), closedAt/By,
  reopenedAt/By/Reason. Unique on (tenant, periodType, startDate).
- **No FinancialYear entity.** Yearly boundaries derive at runtime from
  `TenantSettings.fiscalYearStartMonth` (default January).
- **No FK from journals to periods** for legacy postings — membership is
  date-inferred at query time. Phase 4/5 added `accountingPeriodId` and
  `financialYearLabel` columns on `Transaction` for V2-engine journals only.
- **Monthly and Yearly periods overlap by design** (both cover the same
  dates), so "the period covering a date" is ambiguous — documented in the
  Phase 4 legacy resolver as boundary-day double coverage.

## Period creation

- `POST /api/accounting-periods` creates one period at a time (auto-derives
  the next range). No year-level generation, no complete-coverage guarantee.
- `ensureDefaultAccountingPeriodsForTenant` lazily creates only the current
  calendar month — **gaps are guaranteed** for any skipped month.
- Overlap check exists on creation but not in the database (no constraint),
  and Monthly/Yearly overlap is exempted by the unique key design.

## Date resolution and posting controls

- Legacy `checkPeriodLock` / `assertPeriodOpen`
  (`lib/accountingPeriodService.js`): **fail-open** — allows posting when the
  tenant has zero periods, and swallows unexpected errors with a console
  warning (Phase 1 finding on silent pass-through). Used by legacy posting
  paths; each operational module calls (or forgets to call) it individually.
- Phase 4 engine resolver (`lib/accountingV2/engine/periodResolution.js`):
  server-side, deny-by-default over the same legacy table — typed
  `ClosedAccountingPeriodError`, REOPENED requires permission, backdating
  requires `accountingPosting.backdate`, future dates > 31 days rejected,
  no-covering-period is an error when periods exist. Defects it inherits:
  `financialYearLabel` is just the calendar year of the posting date
  (ignores fiscal start month), UNCONFIGURED tenants pass with a warning, and
  there is no financial-year status, no lock date, no closing-in-progress
  state, no reason/approval capture for backdating.
- Phase 2 legacy adapter (`legacyPeriodResolver.js`) documents the
  AMBIGUOUS/NO_PERIOD/CLOSED decisions for comparison.
- One generic `date` field drives most operational modules; `Transaction`
  V2 columns separate `postingDate` from `entryDate` (transaction date), but
  legacy rows use `date` alone. Document/due dates exist on
  invoices/bills and are not period-relevant (correct), though nothing
  formally documents the date taxonomy.

## Close and reopen

- `POST /api/accounting-periods/[id]/close`: checks drafts, float-tolerance
  debit/credit equality over legacy tables (not the canonical Phase 5
  source), runs `runGlReconciliation`, writes `AccountBalanceHistory` rows
  (stored balances — the Phase 7-prohibited pattern), sets `status='closed'`,
  writes one `auditLog` row. **No close run, no checklist, no review/approve
  separation, no report snapshots, no status history entity.**
- `POST /api/accounting-periods/[id]/reopen`: sets status back with a reason.
  No approval workflow, no impact analysis, no re-close obligation, no
  snapshot supersession.
- Authorization is role-name based (`canManageAccountingPeriods`: Finance or
  Admin) — not permission keys; no separation of duties.

## UI

`app/accounting-periods/page.js` lists periods with create/close/reopen
buttons — no financial-year view, no close checklist, no readiness, no
history.

## Known defects (carried into the Phase 8 requirements)

1. Fail-open period validation on legacy posting paths.
2. No canonical financial year; fiscal start month applied inconsistently
   (engine FY label ignores it).
3. Monthly/Yearly same-date overlap makes period resolution ambiguous.
4. Lazy month creation leaves gaps; no coverage validation.
5. No journal→period FK for legacy rows; reports re-derive membership by
   date, risking boundary drift.
6. Close validates against legacy tables and stores balances in
   `AccountBalanceHistory` instead of snapshotting canonical reports.
7. Single-step close/reopen with no checklist, approvals, history, or
   snapshots; reopened periods behave as fully open (engine at least
   requires a permission).
8. No backdating reason/approval capture; no future-dating policy other than
   the engine's 31-day cap; no lock dates.
9. Imports/webhooks/background jobs rely on whichever legacy guard the code
   path happens to call.
10. Timezone: legacy service mixes `Africa/Blantyre` helpers with local
    server dates; the engine uses UTC midnight — no per-business timezone
    policy.
