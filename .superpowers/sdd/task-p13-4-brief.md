### Task 4: Wave 4 — Reminders + templates + automation foundations + reports + Phase 14 pack

**Depends on:** Waves 1–3 Activity / Call / Email / Meeting / Calendar (WORKING_TREE).

**Files:**
- `lib/admin/crm/reminders.js` — schedule/queue/snooze; dedupe identity; delivery ≠ Activity complete
- Activity/task templates (versioned; active not directly editable)
- `lib/admin/crm/automation/` — rule model, SoD approve (requester ≠ approver), idempotent execution; **small approved trigger set only** (e.g. Lead assigned → first-contact Task; Opportunity stage entry → checklist Task; no-next-action warning). No full sequences; no arbitrary code
- Activity metrics + reliability gate; DQ foundations; reconciliation foundations; reporting centre + scheduled reports (honesty; no false zeroes)
- Foundations upgrade for Activity plane honesty where delivered
- Thin UI for reminders/settings, templates/rules stubs, activity-reports
- Entity integration: ensure Lead/Opportunity activities panels can list Activity projections (thin OK)
- Prisma + `scripts/sql/crm-activity-phase13-wave4.sql`
- Docs pack:
  - `docs/admin-intelligence-crm/phase-13/FINAL_PHASE_13_REPORT.md`
  - `PHASE_14_INPUTS.md`
  - `PHASE_14_READINESS_CHECKLIST.md`
  - Update `FINAL_READINESS_DECISION.md` for phase exit
- Tests: `test/systemAdmin.crm.activityWave4.test.js` (+ Waves 1–3 green)

**Do NOT:** enable Google/Outlook sync, live telephony, AI comms, Demo/Proposal/Tenant provision, full sales sequences, git commit.

## Rules

- Reminder dedupe on rule+activity+recipient+occurrence+channel
- Automation self-approval blocked (SoD)
- Metric/report gate fail → never fabricated zero (EMPTY/UNAVAILABLE/…)
- Weighted Pipeline UI remains dark (Phase 16 — do not touch enablement)
- Exit: **READY_FOR_PHASE_14_WITH_BLOCKERS**

## Acceptance

- [ ] Reminder dedupe; delivery ≠ completion
- [ ] Automation SoD + idempotency; small trigger set only
- [ ] Reports honesty-gated; schedules audited
- [ ] FINAL_PHASE_13_REPORT + PHASE_14_INPUTS + CHECKLIST
- [ ] Exit READY_FOR_PHASE_14_WITH_BLOCKERS
- [ ] Vitest PASS (Wave 4 + prior activity suites)

## Report

`.superpowers/sdd/task-p13-4-report.md` — no commit.
