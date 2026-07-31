# Phase 19 Gap Register

**Audited:** 2026-07-31  
**Inputs:** Phase 18 `PHASE_19_INPUTS.md`, Wave 0 audits, design/plan

| ID | Gap | Severity | Wave | Notes |
|----|-----|----------|------|-------|
| G19-01 | No CustomerAdoptionRequest / ADR numbering | BLOCKER | 1 | Greenfield under `lib/admin/customerSuccess/adoption/*` |
| G19-02 | No consumeTrainingCompletionForAdoption (COMPLETED only) | BLOCKER | 1 | CORRECT_AND_REUSABLE `training/completion.js` |
| G19-03 | No reject auto-create for COMPLETED_WITH_GAPS / partial | BLOCKER | 1 | Honesty lock |
| G19-04 | No manual create / validate / accept / reject Request | BLOCKER | 1 | Server-authorised transitions |
| G19-05 | No attachOnboardingHandoverToAdoption | BLOCKER | 1 | Attach only; never Training COMPLETED |
| G19-06 | No CustomerAdoptionPlan / ADP numbering | BLOCKER | 1 | One Request → one Plan |
| G19-07 | No createCustomerAdoptionPlan + templateVersion pin + idempotency | BLOCKER | 1 | Exact retry |
| G19-08 | No Request/Plan status machines (invalid transition reject) | BLOCKER | 1 | COMPLETED blocked until policy Wave 2 |
| G19-09 | Permissions + listScope / planAccess fail-closed | HIGH | 1 | Reuse CS authz |
| G19-10 | Thin API/UI stubs for requests/plans | HIGH | 1 stubs → 4 | Routes currently NOT_FOUND |
| G19-11 | Seeded ACTIVE plan template version | BLOCKER | 1 | Pin immutable once applied |
| G19-12 | Milestone materialisation from template | BLOCKER | 2 | Idempotent per plan/templateVersion |
| G19-13 | evaluate/attest/waive milestone + evidence modes | BLOCKER | 2 | MILESTONE_TRUTH_RISK |
| G19-14 | Phase 9 evidence snapshots (read-only) | BLOCKER | 2 | Gate fail → UNKNOWN/UNAVAILABLE |
| G19-15 | recordAdoptionValueOutcome + lineage | BLOCKER | 2 | VALUE_TRUTH_RISK |
| G19-16 | evaluateAdoptionPlanCompletion + gated COMPLETED | BLOCKER | 2 | PLAN_TRUTH_RISK |
| G19-17 | Champion upsert (verified contact; no fake scores) | HIGH | 3 | — |
| G19-18 | Dormancy risk queue + recovery case lifecycle | BLOCKER | 3 | DORMANCY_TRUTH_RISK |
| G19-19 | linkPhase8Intervention + outcome attestation | BLOCKER | 3 | Do not rebuild Phase 8 |
| G19-20 | Expansion handoff create/ACK (no billing mutate) | BLOCKER | 3 | EXPANSION_TRUTH_RISK |
| G19-21 | UI hubs Overview/My Work/Team/Portfolio/Attention/queues/detail | MEDIUM | 1–4 | Thin early OK |
| G19-22 | Metrics + reliability gate (never false zero) | HIGH | 4 | Pattern from Training/PA |
| G19-23 | DQ / recon / lineage | HIGH | 4 | — |
| G19-24 | Reports + exports + search/cache (strip secrets/answers) | HIGH | 4 | — |
| G19-25 | Phase 8 Success Plan / Intervention reconcile (`adoptionPlanId` or FKs) | HIGH | 4 | UNKNOWN if unresolved |
| G19-26 | EN + NY i18n for adoption surfaces | MEDIUM | 4 | `customerSuccess.adoptionHub.*` |
| G19-27 | Phase 20 input pack + FINAL_PHASE_19_REPORT | HIGH | 4 | Exit READY_FOR_PHASE_20_WITH_BLOCKERS |
| G19-28 | Virtual provider / recording | CARRY | — | VIRTUAL_PROVIDER_NOT_CONFIGURED (Phase 18) |
| G19-29 | Rich SCORM / question-bank LMS | CARRY | — | NOT_AVAILABLE (Phase 18) |
| G19-30 | Customer training / adoption portal | CARRY | — | CUSTOMER_PORTAL_NOT_CONFIGURED |
| G19-31 | Payment / e-sign | CARRY | — | NOT_CONFIGURED |
| G19-32 | resolveCrmScope stub mode:all | CARRY | Harden | CROSS_TENANT_RISK |
| G19-33 | Prisma EPERM Windows | CARRY | All | SQL + hasCustomerAdoption*Model guards |
| G19-34 | Advanced ML churn / deep renewals execute | CARRY | Phase 20 | NOT_AVAILABLE |
| G19-35 | AI fabricate usage/MET/COMPLETED/RECOVERED/billing | FORBIDDEN | — | Never |
| G19-36 | Intelligence stub / CRM FEATURE_USED pack as Plan truth | PROCESS | All | WRONG_SOURCE guards |
| G19-37 | Phase 8 / Training / Onboarding / Renewals as Adoption spine substitutes | PROCESS | All | WRONG_DOMAIN guards |

**No TBD blocking Wave 1 after CONDITIONAL GO** — Phase 18 Training COMPLETED honesty and onboarding handover are CORRECT_AND_REUSABLE; Phase 8 plans/playbooks/interventions READY for later link; Phase 9 firstValue/adoption/signals READY for Wave 2 evidence; Request/Plan spine expected NOT_FOUND greenfield; Intelligence/CRM stubs explicitly WRONG_SOURCE; Phase 18 carry blockers remain typed NOT_AVAILABLE.
