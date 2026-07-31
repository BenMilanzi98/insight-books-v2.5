### Task 0: Wave 0 — Forensic audits + matrices (docs only)

**Depends on:** Phase 12 exit `READY_FOR_PHASE_13_WITH_BLOCKERS`; approved Phase 13 design + plan.

**Do NOT write application code, Prisma models, APIs, or UI.** Docs under `docs/admin-intelligence-crm/phase-13/` only.

## Required deliverables

Create (non-empty; real findings with paths/classifications):

```
docs/admin-intelligence-crm/phase-13/
├── README.md
├── PHASE_13_SCOPE.md
├── PHASE_INPUT_VALIDATION.md
├── CURRENT_ACTIVITY_ARCHITECTURE_AUDIT.md
├── CURRENT_TASK_MODEL_AUDIT.md
├── CURRENT_FOLLOW_UP_AUDIT.md
├── CURRENT_CALL_MANAGEMENT_AUDIT.md
├── CURRENT_EMAIL_ACTIVITY_AUDIT.md
├── CURRENT_EMAIL_INFRASTRUCTURE_AUDIT.md
├── CURRENT_MEETING_MANAGEMENT_AUDIT.md
├── CURRENT_CALENDAR_AUDIT.md
├── CURRENT_AVAILABILITY_AUDIT.md
├── CURRENT_TIMEZONE_AUDIT.md
├── CURRENT_REMINDER_AUDIT.md
├── CURRENT_CRM_NOTE_AUDIT.md
├── CURRENT_ACTIVITY_TEMPLATE_AUDIT.md
├── CURRENT_ACTIVITY_AUTOMATION_AUDIT.md
├── CURRENT_ACTIVITY_REPORT_AUDIT.md
├── CURRENT_ACTIVITY_EXPORT_AUDIT.md
├── ACTIVITY_DATA_QUALITY_AUDIT.md
├── ACTIVITY_RECONCILIATION_AUDIT.md
├── ACTIVITY_PRIVACY_AUDIT.md
├── ACTIVITY_SECURITY_AUDIT.md
├── ACTIVITY_PERFORMANCE_AUDIT.md
├── ACTIVITY_SOURCE_MATRIX.md
├── ACTIVITY_DOMAIN_MATRIX.md
├── TASK_STATE_MATRIX.md
├── CALL_STATE_MATRIX.md
├── EMAIL_STATE_MATRIX.md
├── MEETING_STATE_MATRIX.md
├── CALENDAR_INTEGRATION_MATRIX.md
├── REMINDER_MATRIX.md
├── CONSENT_ELIGIBILITY_MATRIX.md
├── ACTIVITY_RELIABILITY_MATRIX.md
├── ACTIVITY_SECURITY_MATRIX.md
├── PHASE_13_GAP_REGISTER.md
├── IMPLEMENTATION_PLAN.md
└── FINAL_READINESS_DECISION.md
```

Match Phase 12 Wave 0 style (`docs/admin-intelligence-crm/phase-12/`). Use classification legend: CORRECT_AND_REUSABLE, EXTEND, FOUNDATION, NOT_FOUND, WRONG_DOMAIN, NOT_AVAILABLE, FORBIDDEN, BLOCKED, etc.

## Validate inputs

- `docs/admin-intelligence-crm/phase-12/PHASE_13_INPUTS.md`
- `docs/admin-intelligence-crm/phase-12/PHASE_13_READINESS_CHECKLIST.md`
- `docs/admin-intelligence-crm/phase-12/FINAL_PHASE_12_REPORT.md`
- Design: `docs/superpowers/specs/2026-07-30-sales-activity-phase-13-design.md`
- Plan: `docs/superpowers/plans/2026-07-30-sales-activity-phase-13.md`

Explore codebase for evidence: `lib/admin/crm/*`, Prisma Crm*, `app/insightbooks/crm/*`, email libs, Support/CS tasks (WRONG_DOMAIN), SupportSlaCalendar (WRONG_DOMAIN).

## Locked design (must reflect in readiness)

- Activity parent + typed children; Approach B waves
- SMTP email; Google/Outlook NOT_CONNECTED; telephony NOT_AVAILABLE
- Automation foundations only; reporting centre + schedules in-phase
- Expected Wave 0 decision: **CONDITIONAL GO** for Wave 1 (unless true BLOCKED)

## Acceptance

- [ ] All listed docs exist with real findings (no empty stubs)
- [ ] Phase input validation recorded
- [ ] Gap register + implementation plan pointer
- [ ] FINAL_READINESS_DECISION with CONDITIONAL GO or BLOCKED + rationale
- [ ] No application code changes
- [ ] No git commit

## Report

Write `.superpowers/sdd/task-p13-0-report.md` — status, file list, decision, concerns.
