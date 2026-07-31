# Phase 22 Gap Register

**Audited:** 2026-07-31  
**Inputs:** Wave 0 CURRENT_* audits, compatibility map, design/plan, Phase 21 `PHASE_22_INPUTS.md`, tree phase-18 spine

| ID | Gap | Severity | Wave | Notes |
|----|-----|----------|------|-------|
| G22-01 | No Phase 21 Phase22 handoff accept/validate/consume with checksum | CRITICAL | 1 | Emit exists in `onboarding/training.js`; Training consume NOT_FOUND |
| G22-02 | Handoff accept idempotency / correction / supersession | CRITICAL | 1 | Exact retry same; conflicting key fails |
| G22-03 | Primary source `PHASE_21_TRAINING_HANDOFF` + retarget PHASE_16/17 labels | CRITICAL | 1 | `catalogue.js` TRAINING_REQUEST_SOURCE |
| G22-04 | Domain contract `phase: 18` → 22 + treePhaseAlias | HIGH | 1 | `TRAINING_DOMAIN_CONTRACT` |
| G22-05 | Request/Program status edges (DRAFT→COMPLETED forbid deepen) | HIGH | 1 | `status.js` EXTEND |
| G22-06 | Program create from accepted Phase 21 handoff / Request | CRITICAL | 1 | Without fabricating delivery |
| G22-07 | Invitation lifecycle QUEUED/SENT/DELIVERED/REGISTERED | CRITICAL | 2 | NOT_FOUND; attendance already forbids invite source |
| G22-08 | Enrolment waitlist + registration distinct from invite | HIGH | 2 | `enrolment.js` EXTEND |
| G22-09 | Curriculum ACTIVE immutability + role-module entitlement bind | HIGH | 2 | Core modules EXTEND |
| G22-10 | Course/lesson objectives beyond ModuleVersion contentJson | MEDIUM | 2 | Thin — not blocking if modules suffice |
| G22-11 | Material restricted download reauthorise | HIGH | 2 | FILE_SECURITY_RISK |
| G22-12 | Trainer qualification/capacity hard gates | HIGH | 2 | `trainers.js` / `conflicts.js` |
| G22-13 | Participant consent ≠ Marketing; PII projections | HIGH | 2 | Phase 23 prep |
| G22-14 | Session delivery evidence vs schedule-alone COMPLETED | HIGH | 3 | `sessions.js` TRS- retained |
| G22-15 | Attendance correction approvals deepen | HIGH | 3 | ATTENDANCE_TRUTH_RISK residual |
| G22-16 | Assessment question-bank security + appeals/retake | HIGH | 3 | First-class bank NOT_FOUND / CARRY rich |
| G22-17 | Competency distinct from attendance/completion | HIGH | 3 | NOT_FOUND |
| G22-18 | Completion policy prove UNKNOWN/WITH_GAPS edges | HIGH | 3 | `completion.js` |
| G22-19 | Certificate eligibility UNKNOWN≠issue; revoke/supersede history | HIGH | 3 | `certificates.js` |
| G22-20 | Feedback + quality versioned engines | HIGH | 3 | NOT_FOUND — ≠ Customer Health |
| G22-21 | Refresher/remedial evidence-triggered requirements | HIGH | 3 | Catalogue type only |
| G22-22 | CS outcome handoff checksum/idempotent | CRITICAL | 3 | NOT_FOUND — no auto Healthy |
| G22-23 | PA outcome handoff source-labelled (no Product Events) | CRITICAL | 3 | NOT_FOUND |
| G22-24 | onboardingFeed DOMAIN_SOURCE → PHASE_22_TRAINING (accept legacy) | HIGH | 3 | Currently `PHASE_18_TRAINING` |
| G22-25 | Reliability gate never false zero; portfolio fail-closed | HIGH | 4 | `reliabilityGate.js` / `listScope.js` |
| G22-26 | Search/export/DQ/recon deepen + Phase 21 handoff recon | HIGH | 4 | Present modules EXTEND |
| G22-27 | UI honesty labels progress≠completion≠adoption; EN+NY | MEDIUM | 4 | Thin hubs present |
| G22-28 | Phase 23 input pack + FINAL report + exit WITH_BLOCKERS | HIGH | 4 | Marketing attribution prep |
| G22-29 | Vitest Phase 22 Waves 1–4 | HIGH | 1–4 | New or extend trainingWave* |
| G22-30 | Virtual provider / recording / rich LMS / portal | CARRY | — | Typed NOT_CONFIGURED / NOT_AVAILABLE |
| G22-31 | Payment / e-sign / migration engine / MRA fiscal | CARRY | — | Orthogonal |
| G22-32 | Prisma EPERM Windows | CARRY | All | SQL + hasCustomerTraining*Model guards |
| G22-33 | resolveCrmScope stub mode:all | CARRY | Harden | CROSS_TENANT_RISK |
| G22-34 | Parallel Training domain / Demo→Training / delete CS folders | FORBIDDEN | — | Never |
| G22-35 | Fabricate handoff accept / attendance / results / certs / zeroes | FORBIDDEN | — | Never |

**Wave 0 blocker count for CONDITIONAL GO:** **0** Critical identity/domain blockers (spine exists; Phase 21 exit honest; Demo/onboarding/Adoption quarantined). Critical harden items scheduled Waves 1–3 (expected).

**No TBD blocking Wave 1 after CONDITIONAL GO** — Phase 21 handoff emit + checksum CORRECT_AND_REUSABLE; Training Request/Program spine CORRECT_AND_REUSABLE; Wave 1 is targeted Phase 21 handoff accept + source retarget + Vitest.

