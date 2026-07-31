# FINAL PHASE 8 REPORT — Financial Calendar, Accounting Periods and Period Control Framework

Date: 2026-07-21 · Architecture version: v2 · Status: **COMPLETE** (backend,
APIs, UI, migration, tests); operational-module adoption deferred to Phase 9
by design.

## 1. Executive summary

Phase 8 replaces the lazy, overlapping, fail-open legacy period system with a
canonical, business-scoped financial calendar. Every V2 posting now resolves
its financial year and accounting period server-side from the posting date,
closed periods reject ordinary postings with typed audited errors, and period
close/reopen are controlled, checklist-driven, separated-duty workflows whose
history and snapshots are permanent. All controls are additive and
feature-flag gated; legacy behaviour is preserved until a business is
migrated and its flags enabled.

## 2. Previous-phase evidence reviewed

`PHASE_1_TO_7_EVIDENCE_INDEX.md` (E1–E21): fail-open legacy validation, no
FinancialYear entity, overlapping Monthly/Yearly periods, lazy creation,
missing journal FK, closed-period violations, Phase 2 resolver contract,
Phase 4 posting/adjustment frameworks, Phase 5 canonical ledger, Phase 6
repair framework, Phase 7 TB/report/snapshot/approval engines.

## 3. Existing period defects

`CURRENT_FINANCIAL_CALENDAR_ARCHITECTURE.md`: 10 defects including ambiguous
period resolution, no lifecycle states, single-step close/reopen, no
backdating/future-dating/lock controls, inconsistent timezone handling.

## 4–5. Target architecture and database changes

`TARGET_FINANCIAL_CALENDAR_ARCHITECTURE.md`. Additive migration
`20260721080000_acctv2_financial_calendar` creates:
`AcctV2FinancialCalendarConfig`, `AcctV2FinancialYear`,
`AcctV2AccountingPeriod`, `AcctV2PeriodStatusHistory`,
`AcctV2PeriodCloseRun`, `AcctV2PeriodCloseTask`,
`AcctV2PeriodCloseException`, `AcctV2PeriodReopenRequest` — with business
scoping, uniques (year/period codes, period numbers) and range indexes.

## 6–13. Core implementation

- **Financial Year** (`financialYearService.js`): preview → atomic create
  (year + 12 periods + coverage validation in one transaction) → open (sets
  current, opens DRAFT periods, audits). Overlap rejected; deletion with
  journals rejected.
- **Accounting Period**: monthly generation (`periodGeneration.js`) — leap
  years, 28/29/30/31-day months, non-January year starts, deterministic
  codes `FY2026-P01…P12`.
- **Calendar configuration** (`calendarConfigService.js`): start month/day,
  timezone, backdating/future-dating policies, lock rules, checklist
  template version, approval and snapshot policies; audited updates.
- **Overlap/gap controls**: creation-time rollback + PER-101…110 audit
  (`calendarIntegrityService.js`).
- **Date policies** (`datePolicy.js`): six date kinds; posting date alone
  determines the period; transaction/document dates preserved.
- **Period Resolution Service** (`periodResolutionService.js`):
  deny-by-default; typed errors for gaps, overlaps, closed/closing/reopened
  periods, closed years, unauthorized backdating/future-dating, lock dates;
  every rejection audited; `validatePostingDate` non-throwing guard.
- **Posting Engine integration** (`engine/periodResolution.js`): flag-gated
  delegation to the V2 resolver; journals store resolved year + period;
  client period IDs never trusted.

## 14–16. Operational guards, backdating, future-dating

Guards for all modules/imports/webhooks (`/periods/resolve`,
`validatePostingDate`); backdating = prior-period posting requiring
permission + reason (+ adjustment authority for REOPENED targets);
future-dating tolerance/permission policies. Docs:
`OPERATIONAL_DATE_CONTROLS.md`, `BACKDATING_CONTROLS.md`,
`FUTURE_DATING_CONTROLS.md`.

## 17. Period status lifecycle

`PERIOD_TRANSITIONS` state machine; the only writer is `transitionPeriod`;
immutable `AcctV2PeriodStatusHistory` on every change; lock-date changes
require reason + audit.

## 18–25. Close workflow

Close Run with `closeNumber`/`closeVersion`, one active run per period.
Versioned immutable checklist `STANDARD_MONTHLY_CLOSE` v1 (21 tasks:
TB balance, GL↔JE reconciliation, AR/AP/inventory/payroll/loan controls,
BS equation, posting-state checks, report generation, manual evidence
tasks). Automated checks run against canonical Phase 5/7 services and store
rule/expected/actual/severity. Manual tasks demand evidence; waivers of
blocking tasks demand override permission. Exceptions with always-blocking
categories that can never be accepted. Submit-for-review gate, second-person
approval, then **atomic closure**: status→CLOSED, history, audit, snapshots,
outbox event — all in one transaction. An unbalanced TB blocks the run and
**no balancing entry is ever created** (tested).

## 26–29. Reopening, impact, re-close, adjustments

Reason-mandatory reopen requests with persisted impact analysis (journals,
close runs, snapshots, downstream periods/years, exceptions); second-person
approval; REOPENED periods accept only authorized adjustments within the
approved scope, with re-close deadline monitoring; re-close = new run
version + new snapshots, originals superseded and preserved; four approved
adjustment treatments documented (`CLOSED_PERIOD_ADJUSTMENTS.md`).

## 30. Report snapshots

Phase 7 integration: closure generates TB/IS/BS/CF/Equity + reconciliation
snapshots linked to the close run; reopening supersedes without deleting.

## 31–33. UI and APIs

`/financial-calendar-v2`: calendar summary, year timeline, FY setup
(preview→create→open), period cards, period detail with status-driven
actions, close dashboard (progress, task table, evidence entry, workflow
buttons), reopen approve/reject cards, status history, integrity +
migration panel. Sidebar links added. APIs: 8 routes under
`/api/accounting-v2/periods/**` (`PERIOD_API.md`) — no generic status
endpoint.

## 34–37. Notifications, jobs, security, audit

Outbox events for close started/closed/reopen lifecycle; monitoring job
(missing current period, overdue opens, stalled runs, overdue re-closes,
closed-period attempts); 25 new permissions with separation of duties;
tenant isolation on every query; dual audit (status history +
`recordAccountingAudit` including rejected postings).

## 38–39. Migration and readiness

Five-stage legacy migration (preview → canonical creation with legacy
aliases and closed-status carry-over → date-evidence-only journal
assignment → validation → flag rollout); idempotent; never modifies
amounts/dates (statically enforced by the boundary test). Readiness
assessment with six statuses gates strict enforcement.

## 40. Tests

`test/accountingV2.periods.test.js`: **44 tests, all passing** — generation
(leap years, July–June, gaps/overlaps, atomic rollback), config, FY
lifecycle, integrity rules, date policy, resolution (boundary days, closed,
reopened, backdated, future, lock dates, safe guard), posting-engine flag
gating, full close cycle, blocked close (unbalanced TB, no balancing entry,
period stays unclosed), cancel close, reopen request/impact/approval/reject,
re-close with supersession, lifecycle guards, monitoring, readiness,
migration preview/execute/idempotency. Full V2 suite (boundaries, domain,
posting, engine, ledger, repair, reports + periods): **277 tests passing**.
Pre-existing unrelated failures in legacy UI-helper test files
(`journalAccountSelect`, `incomeStatement*`, missing legacy modules) predate
Phase 8 and are untouched.

## 41–42. Performance and rollout

`PERFORMANCE_VALIDATION.md` (indexed lookups, no global scans, transactional
closure only); six-stage flag rollout with hard readiness gate
(`CONTROLLED_ROLLOUT.md`).

## 43. Remaining period exceptions

Legacy journals without provable dates remain explicit migration exceptions
per business; historical anomalies remain in the Phase 6 register. None were
hidden or force-resolved.

## 44–46. Phase 9 / 12 / 13 readiness

Documented in `PHASE_9_READINESS.md`, `PHASE_12_READINESS.md`,
`PHASE_13_READINESS.md`. Year-end closing entries were **not** implemented
prematurely.

## 47–48. Deployment and rollback

Deploy: `npx prisma migrate deploy && npm run build` → enable
`acctv2.calendarV2` + `acctv2.integrityMonitoring` → run migration preview →
execute per business → verify readiness → enable resolver/strict flags per
stage. Verify: `npx vitest run test/accountingV2.periods.test.js`,
`GET /api/accounting-v2/periods/integrity`. Rollback: disable flags (instant
legacy behaviour); see `ROLLBACK_STRATEGY.md`.

## 49–53. Confirmations

- **No posted journal amount was modified** — no Phase 8 code writes journal
  amounts; the migration writer is statically restricted to period-reference
  fields (boundary test).
- **Closed periods cannot receive ordinary postings** — deny-by-default
  resolver + `ClosedAccountingPeriodError`, tested.
- **Period assignment is server-controlled** — the Posting Command carries
  dates only; the resolver assigns year/period; client period IDs rejected
  by construction.
- **Every status change is audited** — `transitionPeriod` writes immutable
  history in the same transaction; no other writer exists.
- **No arbitrary balancing journal was created** — closure validates and
  records; the blocked-close test asserts the journal count is unchanged.
