# Phase 22 Implementation Plan (from Wave 0)

**Date:** 2026-07-31  
**Readiness:** **CONDITIONAL GO**  
**Architecture:** Approach 1 — harden `lib/admin/customerSuccess/training/**`  
**Docs home:** `docs/admin-intelligence-crm/phase-22/`  
**Code alias:** tree `phase-18/` Training

## Wave 1 — Handoff accept + spine + source retarget

- Implement `acceptTrainingHandoff` / Phase22 consume: checksum validate, UNKNOWN≠VALID, idempotent accept/reject/correct/supersede
- Add `PHASE_21_TRAINING_HANDOFF` primary source; alias map PHASE_16/17 codes
- Bump domain contract `phase: 22`, `treePhaseAlias: 18`
- Harden Request/Program status machines + Program create from accepted handoff
- Vitest: checksum mismatch, exact retry, conflicting idempotency, no Program from emit alone

## Wave 2 — Curriculum / people / invitation honesty

- Curriculum ACTIVE immutability + role-module bind
- Materials restricted download reauth
- Trainer/conflict capacity gates
- Participant PII/consent projections
- **Invitation** lifecycle distinct from enrolment; SENT≠DELIVERED≠REGISTERED≠attended
- Vitest: invite≠attendance; capacity; UNKNOWN participant blocks

## Wave 3 — Delivery truth + outcome handoffs

- Session delivery evidence; attendance corrections
- Assessment security/appeals/retakes; competency distinctness
- Completion policy edges; certificate eligibility/revoke
- Feedback/quality (versioned; ≠ Customer Health)
- Refresher requirements (evidence-triggered) or typed residual
- **CS + PA handoffs** checksum/idempotent; onboardingFeed prefer PHASE_22_TRAINING
- Vitest: invitation≠attendance E2E; cert revoke; CS/PA no Healthy/Events; trained≠adopted

## Wave 4 — UI / metrics / DQ / Phase 23 pack

- Thin hub honesty labels; EN+NY keys
- Reliability-gated metrics/reports; search/export/DQ/recon deepen
- Phase 23 input pack + FINAL_PHASE_22_REPORT + READY_FOR_PHASE_23_WITH_BLOCKERS
- Vitest Wave 4; no false zeroes; portfolio fail-closed

## Stop / gates

- After Wave 0: **SDD review gate** — proceed Wave 1 only when Approved
- No git commit unless user asks; WORKING_TREE OK
- No delete phase-18; no Demo→Training; no second Training domain

