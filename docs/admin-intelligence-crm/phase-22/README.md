# Phase 22 — Customer Training (PRD)

**Authoritative scope:** PRD Phase 22 — Customer Training Management  
**Surface:** `/insightbooks/customer-success/training` (+ overview, my-work, calendar, queues, requests, programs, cohorts, sessions, participants, trainers, curricula, assessments, certificates, reports, settings)  
**Architecture:** Approach 1 — extend existing `CustomerTraining*` + `lib/admin/customerSuccess/training/**` (tree **phase-18** ≡ this PRD phase). **No** parallel Training domain.  
**Design:** `docs/superpowers/specs/2026-07-31-customer-training-phase-22-design.md`  
**Plan:** `docs/superpowers/plans/2026-07-31-customer-training-phase-22.md`  
**Code alias (canonical):** Tree `docs/admin-intelligence-crm/phase-18/` Training docs + `lib/admin/customerSuccess/training/**`  
**Docs home (this pack):** `docs/admin-intelligence-crm/phase-22/`  
**Upstream exit:** Phase 21 `READY_FOR_PHASE_22_WITH_BLOCKERS` (`docs/admin-intelligence-crm/phase-21/PHASE_22_INPUTS.md`)

**Wave 0 decision:** **CONDITIONAL GO** for Wave 1 — see `PHASE_INPUT_VALIDATION.md` + `PHASE_22_GAP_REGISTER.md`

**Execution mode:** Subagent-Driven. Wave 1 may proceed after controller review of this pack.

## Phase-label correction (read first)

| PRD | Content | Tree folder / code today | Status for this pack |
|-----|---------|--------------------------|----------------------|
| 18 | Demo Management | `lib/admin/crm/demos/**` | **Preserve — distinct**; never Demo→Training |
| 20 | Lead Conversion / Closed-Won | Tree phase-16 + `phase-20/` | Upstream commercial/identity only |
| 21 | Customer Onboarding | Tree phase-17 + `phase-21/` | Consume Phase 22 Training handoff emit; coordination only |
| **22** | **Customer Training** | Tree **phase-18** + this `phase-22/` | **This phase** — harden + docs re-home |
| 23 | Marketing Attribution | Phase 23 pack target | Exit pack after Wave 4 |
| FUTURE CS | Adoption / renewals | Tree phase-19 | Quarantine — completion ≠ adoption |

## Wave status

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Forensic audits + roadmap/compatibility/mislabel maps + readiness | Complete (2026-07-31) — **CONDITIONAL GO** |
| 1 | Phase 21 handoff validate/accept + Request/Program spine + source retarget | Complete (WORKING_TREE) |
| 2 | Curriculum/materials/trainers/cohorts/participants/enrolment/invitation honesty | Complete (WORKING_TREE) |
| 3 | Sessions/attendance/exercises/assessments/results/completion/certs + CS/PA handoffs | Complete (WORKING_TREE) |
| 4 | UI/metrics/DQ/recon/search/exports + Phase 23 pack + exit | Complete (WORKING_TREE) — **READY_FOR_PHASE_23_WITH_BLOCKERS** |

**Exit pack:** `PHASE_23_INPUTS.md`, `PHASE_23_READINESS_CHECKLIST.md`, `FINAL_PHASE_22_REPORT.md`, `FINAL_READINESS_DECISION.md`

## Hard rules

- Phase 21 Training Handoff ≠ Request ≠ Program ≠ Cohort ≠ Session
- Invitation queued ≠ sent ≠ delivered ≠ registered ≠ attended
- Calendar accept / meeting-link ≠ attendance; attendance ≠ competency ≠ completion ≠ Product adoption
- Certificate ≠ entitlement ≠ professional accreditation
- Exact retries must not duplicate handoff acceptances, Requests, Programs, Sessions, attendance, attempts, certificates, CS/PA handoffs
- UNKNOWN ≠ VALID/ELIGIBLE/COMPLETED; gate fail → `UNAVAILABLE` / `value: null` (never false zero)
- No second Training domain; no delete of tree-18 / onboarding / Adoption / Demo
- Expected phase exit (Wave 4): **READY_FOR_PHASE_23_WITH_BLOCKERS**

## Classification legend

| Class | Meaning |
|-------|---------|
| CORRECT_AND_REUSABLE | Keep; do not redefine |
| REUSE_WITH_RECONCILIATION | Reuse with explicit mapping |
| EXTEND | Reuse and harden under Training |
| MISLABELLED_PHASE | Wrong PRD number / folder label |
| FUTURE_PHASE_SCOPE | Out of this phase (Adoption, rich LMS, etc.) |
| NOT_FOUND | Missing surface required by PRD 22 |
| *_TRUTH_RISK | Honesty risk classes (attendance/assessment/completion/certificate) |
| FORBIDDEN | Never invent / never absorb |

## Pack index (Wave 0)

- `PHASE_22_SCOPE.md`, `AUTHORITATIVE_ROADMAP_MAP.md`, `MISLABELLED_TRAINING_ARTIFACT_AUDIT.md`
- `TRAINING_COMPATIBILITY_MAP.md`, `PHASE_INPUT_VALIDATION.md`
- `CURRENT_TRAINING_*` audits (architecture through export)
- `TRAINING_{DATA_QUALITY,RECONCILIATION,PRIVACY,SECURITY,PERFORMANCE}_AUDIT.md`
- `PHASE_22_GAP_REGISTER.md`, `IMPLEMENTATION_PLAN.md`

