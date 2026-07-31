# Phase 17 Gap Register

**Audited:** 2026-07-31  
**Inputs:** Phase 16 `PHASE_17_INPUTS.md`, Wave 0 audits, design/plan

| ID | Gap | Severity | Wave | Notes |
|----|-----|----------|------|-------|
| G17-01 | No CustomerOnboardingRequest / ONR numbering | BLOCKER | 1 | Greenfield under `lib/admin/customerSuccess/onboarding/*` |
| G17-02 | No consumeOnboardingHandoff from Phase 16 ONBOARDING | BLOCKER | 1 | CORRECT_AND_REUSABLE emit in `onboardingHandoff.js` |
| G17-03 | No accept/reject/validate Request + status history | BLOCKER | 1 | Server-authorised transitions |
| G17-04 | No CustomerOnboardingProject / ONB numbering | BLOCKER | 1 | One Request → one Project |
| G17-05 | No createOnboardingProject + idempotency/conflict fail | BLOCKER | 1 | Exact retry |
| G17-06 | No seeded ACTIVE STANDARD templateVersion for Project pin | BLOCKER | 1 | Prefer pin always; full templates Wave 2 |
| G17-07 | No Request/Project status machines (invalid transition reject) | BLOCKER | 1 | No IN_PROGRESS→COMPLETED skip |
| G17-08 | Permissions skeleton `onboarding*` | HIGH | 1 | Today only `customerSuccess.read` on foundations route |
| G17-09 | Thin API/UI stubs for requests/projects | HIGH | 1 stubs → 4 | Foundations page DISCONNECTED |
| G17-10 | Full Template/Version/approval/applicability | BLOCKER | 2 | UNVERSIONED today |
| G17-11 | materialiseOnboardingTemplate once | BLOCKER | 2 | Workstreams/Milestones/Tasks/Checklists |
| G17-12 | Kick-off ↔ Phase 13 Meeting; RSVP≠attendance; fail closed | BLOCKER | 2 | `lib/admin/crm/meetings/*` CORRECT_AND_REUSABLE |
| G17-13 | Stakeholders + Contact verification | HIGH | 2 | CONTACT_PRIVACY_RISK |
| G17-14 | Requirements/scope + Change Request on mismatch | BLOCKER | 2 | Never silent entitlement escalate |
| G17-15 | Customer Task evidence attestation + review SoD | BLOCKER | 2 | CUSTOMER_ACTION_TRUTH_RISK / TASK_COMPLETION_TRUTH_RISK |
| G17-16 | Task dependencies + cycle detection | HIGH | 2 | — |
| G17-17 | Responsibilities CUSTOMER/INSIGHTBOOKS/SHARED | HIGH | 2 | — |
| G17-18 | Tenant/Business/Branch/User/Config readiness evaluate | BLOCKER | 3 | UNKNOWN≠READY; CROSS_* risks |
| G17-19 | Accounting readiness boundary assert (no journals/OB) | HIGH | 3 | Reuse `accountingBoundary.js` pattern |
| G17-20 | Migration coordination + recon gate + private files | BLOCKER | 3 | MIGRATION_TRUTH_RISK / FILE_SECURITY_RISK; engine NOT_AVAILABLE |
| G17-21 | MRA readiness coordination (no fiscal/credentials) | HIGH | 3 | CORRECT_AND_REUSABLE handoff; fiscal WRONG_DOMAIN |
| G17-22 | Training coordination (no COMPLETED without Phase 18) | HIGH | 3 | TRAINING_TRUTH_RISK |
| G17-23 | Testing/defects + Critical blocks go-live | HIGH | 3 | — |
| G17-24 | Go-live readiness/approval/execution → STABILISATION | BLOCKER | 3 | GO_LIVE_TRUTH_RISK; activation WRONG_DOMAIN |
| G17-25 | Stabilisation exit + handover accept | BLOCKER | 3 | — |
| G17-26 | Onboarding completion certificate checksum + idempotent | BLOCKER | 3 | ≠ conversion certificate |
| G17-27 | Health/progress server calcs (no ML; progress≠complete) | HIGH | 3 | — |
| G17-28 | UI hubs Overview/My Work/queues/detail tabs | MEDIUM | 1–4 | Thin early OK |
| G17-29 | Metrics + reliability gate (never false zero) | HIGH | 4 | Pattern from conversion |
| G17-30 | DQ / recon / lineage | HIGH | 4 | — |
| G17-31 | Reports + exports + search/cache (strip secrets) | HIGH | 4 | — |
| G17-32 | Phase 8 CsOnboardingRecord → onboardingProjectId migrate | HIGH | 4 | REUSE_WITH_RECONCILIATION; UNKNOWN if unresolved |
| G17-33 | EN + NY i18n for onboarding surfaces | MEDIUM | 4 | — |
| G17-34 | Phase 18 input pack + FINAL_PHASE_17_REPORT | HIGH | 4 | Exit READY_FOR_PHASE_18_WITH_BLOCKERS |
| G17-35 | Customer portal evidence | CARRY | — | CUSTOMER_PORTAL_NOT_CONFIGURED |
| G17-36 | Full Training / migration engine / MRA fiscal | CARRY | — | NOT_AVAILABLE |
| G17-37 | Payment / e-sign providers | CARRY | — | Phase 16 NOT_CONFIGURED |
| G17-38 | resolveCrmScope stub mode:all | CARRY | Harden | CROSS_TENANT_RISK |
| G17-39 | Prisma EPERM Windows | CARRY | All | SQL + has*Model guards |
| G17-40 | AI plans/scores/approvals; fabricate complete/PAID | FORBIDDEN | — | Never |
| G17-41 | CS expansion / CsTask / Support as onboarding truth | PROCESS | All | WRONG_DOMAIN guards |
| G17-42 | Telephony / calendar sync / Lead ingest / Demo cloud | CARRY | Orthogonal | NOT_AVAILABLE / NOT_CONNECTED |

**No TBD blocking Wave 1 after CONDITIONAL GO** — Phase 16 ONBOARDING/TRAINING/MIGRATION/MRA handoffs are CORRECT_AND_REUSABLE and distinct; Customer/Tenant/Subscription pins available from conversion; Request/Project spine expected NOT_FOUND greenfield; Meetings CORRECT_AND_REUSABLE for Wave 2; Phase 8 foundations REUSE_WITH_RECONCILIATION for Wave 4.
