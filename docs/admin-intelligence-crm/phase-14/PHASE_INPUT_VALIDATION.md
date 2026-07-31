# Phase 14 Input Validation

**Validated:** 2026-07-30  
**Upstream exit:** `READY_FOR_PHASE_14_WITH_BLOCKERS` (Phase 13 `FINAL_PHASE_13_REPORT.md`)

## Sources checked

| Source | Path | Result |
|--------|------|--------|
| Phase 14 inputs | `docs/admin-intelligence-crm/phase-13/PHASE_14_INPUTS.md` | PRESENT — Activity/Meeting/Follow-Up/eligibility consume contracts listed |
| Readiness checklist | `docs/admin-intelligence-crm/phase-13/PHASE_14_READINESS_CHECKLIST.md` | PRESENT — must-be-true items checked; carry blockers listed; Demo deferred to P14 |
| Final Phase 13 report | `docs/admin-intelligence-crm/phase-13/FINAL_PHASE_13_REPORT.md` | PRESENT — exit `READY_FOR_PHASE_14_WITH_BLOCKERS`; Vitest 43/43 |
| Design | `docs/superpowers/specs/2026-07-30-demo-management-phase-14-design.md` | APPROVED 2026-07-30 |
| Plan | `docs/superpowers/plans/2026-07-30-demo-management-phase-14.md` | PRESENT — Approach B waves; Task 0 = this pack |

## Phase 13 must-be-true (consumed honestly)

| Gate | Evidence class |
|------|----------------|
| Canonical CrmActivity + ACT numbering | CORRECT_AND_REUSABLE — `lib/admin/crm/activities/*`, Prisma `CrmActivity` |
| Task / Follow-Up / Note under Activity | CORRECT_AND_REUSABLE — `tasks.js`, `followUps.js`, `notes.js` |
| Call manual/planned; telephony NOT_AVAILABLE | CORRECT_AND_REUSABLE — `lib/admin/crm/calls/*` |
| Email SMTP; accept ≠ delivered | CORRECT_AND_REUSABLE — `lib/admin/crm/emails/*` |
| Meeting + internal Calendar + ICS; RSVP ≠ attendance | CORRECT_AND_REUSABLE / EXTEND for Demo schedule — `meetings/*`, `calendar/*` |
| Google/Outlook NOT_CONNECTED | CORRECT_AND_REUSABLE boundary |
| Reminders; delivery ≠ Activity complete | CORRECT_AND_REUSABLE |
| Templates + automation foundations | CORRECT_AND_REUSABLE pattern for Demo templates later |
| Activity reports honesty-gated | CORRECT_AND_REUSABLE pattern for Demo reports |
| Lead/Opportunity Activity projections | CORRECT_AND_REUSABLE |
| `ACTIVITY_SPINE` READY | CORRECT_AND_REUSABLE — `foundations.js` |
| Demo management deferred | CORRECT_AND_REUSABLE (boundary) — explicit P13 out-of-scope |

## Phase 14 reuse plane (pre-Wave-1)

| Asset | Path | Class for Demo |
|-------|------|----------------|
| Lead `DEMO_REQUEST` type | `catalogue.js` `CRM_LEAD_TYPE.DEMO_REQUEST` | FOUNDATION — convert source |
| Capture `REQUEST_DEMO` | `capture.js`, `/request-demo`, `/api/request-demo` | FOUNDATION — intake only |
| Contact demo-request wire | `app/api/contact/demo-request/route.js` | FOUNDATION — Lead + email; not CrmDemoRequest |
| CrmMeeting create/reschedule/RSVP/attendance | `lib/admin/crm/meetings/*` | EXTEND — required on Demo schedule |
| CrmCalendarEvent + ICS + conflicts | `lib/admin/crm/calendar/*` | EXTEND — reconcile Demo times |
| Follow-Up / Next-Action | `followUps.js`, `nextAction.js` | EXTEND — post-Demo follow-ups |
| Consent / eligibility | `consent.js`, `eligibility.js` | CORRECT_AND_REUSABLE — outbound + recording consent patterns |
| Proposal readiness handoff | `opportunities/proposalReadiness.js` | CORRECT_AND_REUSABLE — handoff-only; never create Proposal |
| Conversion readiness handoff | `opportunities/conversionReadiness.js` | CORRECT_AND_REUSABLE — handoff-only |
| Opportunity stage/probability/close | `opportunities/*` | CORRECT_AND_REUSABLE boundary — Demo outcome must not auto-mutate |
| Activity report honesty | `activities/reports.js` | CORRECT_AND_REUSABLE pattern |
| `resolveCrmScope` | `authz.js` | PARTIAL / CARRY — stub `mode: 'all'` |
| MRA EIS sandbox entitlement | `lib/mraEis/*`, `lib/admin/customers/mraEis.js` | WRONG_DOMAIN / FORBIDDEN as Demo Environment |
| Tenant POS sales | Tenant `sales.*` | WRONG_DOMAIN |
| CsTask / Support | CS / Support planes | WRONG_DOMAIN |
| CrmDemo* models / `lib/admin/crm/demos/*` | — | NOT_FOUND |
| Demo hub UI `/insightbooks/crm/demos` | — | NOT_FOUND |
| Demo APIs `/api/admin/crm/demos/**` | — | NOT_FOUND |

## Identity / consent blockers?

**None** that block Wave 1 Demo Request + Demo spine. Consent/eligibility services exist and fail-closed on UNKNOWN. Recording provider remains NOT_AVAILABLE (governance-only in later waves). Meeting/Calendar READY for schedule reuse.

## Validation verdict

**PASS** — Phase 13 exit is honest; design/plan locked; reuse plane identified (Lead DEMO_REQUEST FOUNDATION; Meeting/Calendar EXTEND; MRA sandbox WRONG_DOMAIN; CrmDemo* NOT_FOUND). Proceed to Wave 0 readiness decision (**CONDITIONAL GO** expected).
