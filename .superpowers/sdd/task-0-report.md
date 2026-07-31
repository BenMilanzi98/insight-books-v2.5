# Task 0 Report — Phase 17 Wave 0 Forensic Audits

**Task:** Wave 0 — Forensic audits + matrices + readiness (Customer Onboarding Phase 17)  
**Date:** 2026-07-31  
**Branch:** `v2` (in-place; no worktree)  
**Commits:** none (WORKING_TREE only — per user rule)

## Status

**DONE**

## Decision

**CONDITIONAL GO** — recorded in `docs/admin-intelligence-crm/phase-17/FINAL_READINESS_DECISION.md` (Wave 0 interim).  
Full phase exit / `FINAL_PHASE_17_REPORT.md` deferred to Wave 4.  
Execution mode: Subagent-Driven (already chosen); Wave 1 may proceed after controller review.

## Deliverables created

All under `docs/admin-intelligence-crm/phase-17/`:

### Core
- `README.md` — overview, wave table, hard rules, classification legend
- `PHASE_17_SCOPE.md`
- `PHASE_INPUT_VALIDATION.md` — PASS on Phase 16 `READY_FOR_PHASE_17_WITH_BLOCKERS`
- `PHASE_17_GAP_REGISTER.md` — G17-01…42 mapped to Waves 1–4 / CARRY / FORBIDDEN
- `IMPLEMENTATION_PLAN.md` — pointer + wave/gap mapping (Tasks 1–4)
- `FINAL_READINESS_DECISION.md` — **CONDITIONAL GO**

### CURRENT_* audits
- Architecture, Request, Project, Template, Kickoff, Stakeholder
- Workstream, Milestone, Task, Checklist, Customer Responsibility
- Tenant Readiness, Business/Branch Setup, User Access, Product Configuration, Accounting Setup
- Data Migration Coordination, MRA EIS, Training Coordination, Testing
- Go-Live, Stabilisation, Handover, Completion
- Onboarding Report, Onboarding Export

### ONBOARDING_* cross-cutting
- Data Quality, Reconciliation, Privacy, Security, Performance

### Matrices
- Source, Domain, Type, Template, Workstream, Milestone, Task, Responsibility
- Tenant Readiness, Migration, MRA, Training, Testing, Go-Live, Completion
- Reliability, Security

## Key forensic findings (evidence-based)

| Finding | Class | Path |
|---------|-------|------|
| Phase 16 ONBOARDING handoff emit idempotent; never complete | CORRECT_AND_REUSABLE | `lib/admin/crm/conversions/onboardingHandoff.js`, `handoffShared.js` |
| TRAINING / MIGRATION / MRA_EIS handoffs distinct | CORRECT_AND_REUSABLE | `trainingHandoff.js`, `migrationHandoff.js`, `mraEisHandoff.js` |
| `CrmConversionDomainHandoff` model | CORRECT_AND_REUSABLE | `prisma/schema.prisma`, `scripts/sql/crm-conversion-phase16-wave4.sql` |
| Request/Project spine / `lib/admin/customerSuccess/onboarding/**` | NOT_FOUND | Expected Wave 1 greenfield |
| Phase 8 `CsOnboardingRecord` + foundations | REUSE_WITH_RECONCILIATION | `prisma` model; `lib/admin/customerSuccess/foundations.js` — empty → NOT_INSTRUMENTED; `progressPercent: null` |
| CS onboarding UI | DISCONNECTED | `app/insightbooks/customer-success/onboarding/page.js` — foundations view only |
| CS expansion handoffs / CsTask | WRONG_DOMAIN | `handoffs.js`, `tasks.js` |
| Phase 13 Meetings | CORRECT_AND_REUSABLE | `lib/admin/crm/meetings/*` — RSVP ≠ attendance |
| Accounting boundary pattern | REUSE_WITH_RECONCILIATION | `conversions/accountingBoundary.js` |
| MRA EIS fiscal domain | WRONG_DOMAIN for execution | `lib/mraEis/**` — coordinate only |
| Conversion completion certificate | WRONG_DOMAIN if equated to onboarding complete | `conversions/completion.js` |
| `resolveCrmScope` stub | CROSS_TENANT_RISK | `lib/admin/crm/authz.js` `mode: 'all'` |
| Customer portal | NOT_AVAILABLE | `CUSTOMER_PORTAL_NOT_CONFIGURED` |

## Self-review checklist

- [x] No empty placeholder audits — each file has tables with real paths/classes
- [x] No invented green status for missing domains — marked NOT_FOUND / EXTEND / REIMPLEMENT as appropriate
- [x] Handoff ≠ Request ≠ Project preserved
- [x] ONBOARDING / TRAINING / MIGRATION / MRA distinct
- [x] Phase 16 exit `READY_FOR_PHASE_17_WITH_BLOCKERS` validated
- [x] Decision explicit: CONDITIONAL GO (not BLOCKED)
- [x] No application code
- [x] No git commit

## Concerns

1. Phase 16 Wave 0 README still shows Waves 1–3 as "Not started" while Wave 4 code exists in WORKING_TREE — Phase 17 Wave 0 treats conversion handoffs as present/CORRECT_AND_REUSABLE based on filesystem evidence (accurate for this workspace).
2. `CsOnboardingRecord` allows free `status`/`completedAt` without evidence — Wave 4 must link or mark UNKNOWN; never invent COMPLETED from historical rows.
3. Carry CROSS_TENANT_RISK (`resolveCrmScope`) remains for ops harden — does not block Wave 1 spine if CS portfolio authz is applied to onboarding.

## Stop

No Wave 1 code in Task 0. Controller may dispatch Task 1 after review.
