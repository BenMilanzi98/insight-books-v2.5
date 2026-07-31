# Phase 18 Scope — Customer Training

**Audited:** 2026-07-31  
**Upstream:** Phase 17 `READY_FOR_PHASE_18_WITH_BLOCKERS`  
**Design locks:** Dual-entity Request/Program; auto Request from Phase 16 TRAINING handoff (+ Phase 17 coordination); Phase 13 Sessions; knowledge-check + practical + checksum certificates; Approach B waves

## In scope

1. Consume Phase 16 `CrmConversionDomainHandoff` type `TRAINING` → idempotent `CustomerTrainingRequest` (`TRQ-`)
2. Link/consume Phase 17 `CustomerOnboardingTraining` coordination (never fabricate COMPLETED from onboarding alone)
3. Human validate/accept/reject Request; convert to `CustomerTrainingProgram` (`TRN-`) with pinned `curriculumVersionId`
4. Versioned curricula/modules + role-module mapping bounded by entitlement
5. Participants (verified identity), Trainers (skills/conflicts), Cohorts, Sessions via Phase 13 Meetings
6. Source-backed attendance (RSVP/invite/link ≠ attendance); practical exercises
7. Knowledge-check + practical assessments; immutable final results; retake/regrade with original preserved
8. Deterministic Participant/Program completion against versioned policy; checksummed certificates
9. Typed outcome feed → Phase 17 `trainingDomainSource` / `trainingDomainStatus` only
10. Training health/progress (deterministic, no ML); reliability gate; DQ/recon; reports/exports
11. Reconcile Phase 8 `CsTrainingRecord` via Program link (Wave 4) — UNKNOWN if unresolved
12. Phase 19 input pack at exit

## Out of scope (explicit)

- Full general-purpose LMS / SCORM / public marketplace / paid public courses
- Full video-streaming platform / rich content-authoring suite
- AI-generated content, questions, attendance, results, certificates
- Biometric / face-recognition attendance
- Automatic Training / onboarding / Health / Subscription / entitlement changes
- Virtual provider / recording production integration (typed `VIRTUAL_PROVIDER_NOT_CONFIGURED`)
- Tenant accounting postings; billing SoT changes; MRA fiscal submissions
- Complete Customer onboarding / migration / Support reimplementation
- Phase 19 Adoption Operations (consumes Phase 18 outcomes)
- System `/insightbooks/chart-of-accounts` reintroduction

## Carry blockers (document honesty)

| Blocker | Class |
|---------|-------|
| Virtual meeting provider / recording | NOT_AVAILABLE / `VIRTUAL_PROVIDER_NOT_CONFIGURED` |
| Rich SCORM / question-bank LMS authoring | NOT_AVAILABLE |
| Customer evidence portal | NOT_AVAILABLE / `CUSTOMER_PORTAL_NOT_CONFIGURED` (Phase 17 carry) |
| Full migration engine / MRA fiscal | NOT_AVAILABLE (orthogonal) |
| Payment / e-sign providers | NOT_CONFIGURED (Phase 16 carry) |
| `resolveCrmScope` stub `mode: 'all'` | CROSS_TENANT_RISK / CARRY — `lib/admin/crm/authz.js` |
| Prisma EPERM on Windows | CARRY — SQL + `hasCustomerTraining*Model` / `hasCs*` guards |
| Rich Training UI hubs | Thin stubs OK early waves |
| Telephony / calendar sync / Lead ingest / Demo cloud | Orthogonal CARRY |

## Success exit (expected)

`READY_FOR_PHASE_19_WITH_BLOCKERS` when optional virtual provider / recording / rich authoring / portal remain explicit typed unavailable.
