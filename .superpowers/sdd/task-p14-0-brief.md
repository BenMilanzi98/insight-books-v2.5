### Task 0: Wave 0 — Forensic audits + matrices (docs only)

**Depends on:** Phase 13 exit `READY_FOR_PHASE_14_WITH_BLOCKERS`; approved Phase 14 design + plan.

**Do NOT write application code, Prisma models, APIs, or UI.** Docs under `docs/admin-intelligence-crm/phase-14/` only.

## Required deliverables

Create (non-empty; real findings with paths/classifications):

```
docs/admin-intelligence-crm/phase-14/
├── README.md
├── PHASE_14_SCOPE.md
├── PHASE_INPUT_VALIDATION.md
├── CURRENT_DEMO_ARCHITECTURE_AUDIT.md
├── CURRENT_DEMO_REQUEST_AUDIT.md
├── CURRENT_DEMO_SCHEDULING_AUDIT.md
├── CURRENT_DEMO_AGENDA_AUDIT.md
├── CURRENT_DEMO_SCRIPT_AUDIT.md
├── CURRENT_DEMO_CONTENT_AUDIT.md
├── CURRENT_DEMO_ENVIRONMENT_AUDIT.md
├── CURRENT_DEMO_DATA_AUDIT.md
├── CURRENT_DEMO_CREDENTIAL_AUDIT.md
├── CURRENT_DEMO_CHECKLIST_AUDIT.md
├── CURRENT_DEMO_REHEARSAL_AUDIT.md
├── CURRENT_DEMO_DELIVERY_AUDIT.md
├── CURRENT_DEMO_ATTENDANCE_AUDIT.md
├── CURRENT_DEMO_RECORDING_AUDIT.md
├── CURRENT_DEMO_FEEDBACK_AUDIT.md
├── CURRENT_DEMO_OUTCOME_AUDIT.md
├── CURRENT_DEMO_FOLLOW_UP_AUDIT.md
├── CURRENT_DEMO_REPORT_AUDIT.md
├── CURRENT_DEMO_EXPORT_AUDIT.md
├── DEMO_DATA_QUALITY_AUDIT.md
├── DEMO_RECONCILIATION_AUDIT.md
├── DEMO_PRIVACY_AUDIT.md
├── DEMO_SECURITY_AUDIT.md
├── DEMO_PERFORMANCE_AUDIT.md
├── DEMO_SOURCE_MATRIX.md
├── DEMO_DOMAIN_MATRIX.md
├── DEMO_REQUEST_STATE_MATRIX.md
├── DEMO_STATE_MATRIX.md
├── DEMO_READINESS_MATRIX.md
├── DEMO_PARTICIPANT_MATRIX.md
├── DEMO_AGENDA_MATRIX.md
├── DEMO_SCRIPT_MATRIX.md
├── DEMO_ENVIRONMENT_MATRIX.md
├── DEMO_DATA_MATRIX.md
├── DEMO_RECORDING_CONSENT_MATRIX.md
├── DEMO_OUTCOME_MATRIX.md
├── DEMO_RELIABILITY_MATRIX.md
├── DEMO_SECURITY_MATRIX.md
├── PHASE_14_GAP_REGISTER.md
├── IMPLEMENTATION_PLAN.md
└── FINAL_READINESS_DECISION.md
```

Match Phase 12/13 Wave 0 style. Classification legend: CORRECT_AND_REUSABLE, EXTEND, FOUNDATION, NOT_FOUND, WRONG_DOMAIN, NOT_AVAILABLE, FORBIDDEN, BLOCKED, etc.

## Validate inputs

- `docs/admin-intelligence-crm/phase-13/PHASE_14_INPUTS.md`
- `docs/admin-intelligence-crm/phase-13/PHASE_14_READINESS_CHECKLIST.md`
- `docs/admin-intelligence-crm/phase-13/FINAL_PHASE_13_REPORT.md`
- Design + plan under `docs/superpowers/`

Explore: no CrmDemo*; Lead DEMO_REQUEST / request-demo capture; Meeting ≠ Demo; MRA EIS sandbox WRONG_DOMAIN; P13 Meeting/Calendar ready for schedule reuse.

## Locked design (must reflect)

- Logical environments; recording governance only; required Meeting on schedule
- Reporting centre in-phase; Proposal/Trial handoff-only
- Expected decision: **CONDITIONAL GO** for Wave 1 unless true BLOCKED

## Acceptance

- [ ] All listed docs exist with real findings
- [ ] Phase input validation recorded
- [ ] Gap register + implementation plan pointer
- [ ] FINAL_READINESS_DECISION CONDITIONAL GO or BLOCKED
- [ ] No application code; no git commit

## Report

`.superpowers/sdd/task-p14-0-report.md`
