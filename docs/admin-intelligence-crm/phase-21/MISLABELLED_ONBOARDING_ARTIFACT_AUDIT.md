# Mislabelled Onboarding Artifact Audit — PRD Phase 21

**Audited:** 2026-07-31  
**Rule:** Do not delete working onboarding/training/adoption code. Re-home docs to `phase-21/`; quarantine FUTURE packs.

| Artifact | Present label | Authoritative truth | Class | Action |
|----------|---------------|---------------------|-------|--------|
| `docs/admin-intelligence-crm/phase-17/**` | Phase 17 Customer Onboarding | **PRD Phase 21** Customer Onboarding | MISLABELLED_PHASE | Preserve; new forensics/exit in `phase-21/` |
| `lib/admin/customerSuccess/onboarding/**` | Comments/contracts say “Phase 17” | PRD 21 SoT | CORRECT_AND_REUSABLE code / MISLABELLED_PHASE label | Harden in place; bump domain contract label Wave 4 |
| `docs/superpowers/specs/2026-07-31-customer-onboarding-phase-17-design.md` | phase-17 design | Alias of PRD 21 design | MISLABELLED_PHASE / REUSE | Keep as alias; authoritative design is phase-21-design |
| `docs/superpowers/plans/2026-07-31-customer-onboarding-phase-17.md` | phase-17 plan | Historical tree plan | MISLABELLED_PHASE | Historical; Phase 21 plan supersedes for Waves |
| `test/systemAdmin.cs.onboardingWave{1..4}.test.js` | onboardingWave | Tree-17 wave tests | CORRECT_AND_REUSABLE | Extend with Phase 21 gap cases |
| `docs/admin-intelligence-crm/phase-17/PHASE_18_INPUTS.md` | Phase 18 inputs from onboarding | Training handoff target = **PRD 22** | MISLABELLED_PHASE numbering | Preserve; Phase 21 Wave 4 emits `PHASE_22_INPUTS.md` |
| `docs/admin-intelligence-crm/phase-17/FINAL_READINESS_DECISION.md` | READY_FOR_PHASE_18_WITH_BLOCKERS | Tree exit after onboarding Waves 1–4 | REUSE_WITH_RECONCILIATION | Evidence that spine exists; PRD exit becomes READY_FOR_PHASE_22_WITH_BLOCKERS |
| `docs/admin-intelligence-crm/phase-18/**` | Phase 18 Training | **FUTURE PRD 22** | FUTURE_PHASE_SCOPE / MISLABELLED_PHASE | Banner; do not delete; do not absorb |
| `lib/admin/customerSuccess/training/**` | Training domain | FUTURE PRD 22 | FUTURE_PHASE_SCOPE | Quarantine; Phase 21 emits Training handoff only |
| `docs/admin-intelligence-crm/phase-19/**` | Phase 19 Adoption | FUTURE CS adoption | FUTURE_PHASE_SCOPE / MISLABELLED_PHASE | Banner; do not delete |
| `lib/admin/customerSuccess/adoption/**` | Adoption domain | FUTURE | FUTURE_PHASE_SCOPE | Quarantine |
| `phase-19/PHASE_20_INPUTS.md` | “Phase 20” renewals | CS renewals after Adoption | NON_AUTHORITATIVE | Never use as conversion or onboarding Project create |
| Phase 20 PRD “Create the onboarding project once” | Conversion bullet | Project create = PRD 21 | REUSE_WITH_RECONCILIATION | Phase 20 handoff-only (G20-26) |
| Foundations CS onboarding page (historical) | Early foundations view | Superseded by Request/Project hubs | DISCONNECTED residual | Do not treat as spine |

## Banner requirements (Wave 0)

| Pack | Banner must state |
|------|-------------------|
| Training `phase-18/README.md` | FUTURE vs **PRD 21** (onboarding) and aligns with **PRD 22** |
| Adoption `phase-19/README.md` | FUTURE vs **PRD 21**; do not redefine onboarding |
| Onboarding `phase-17/README.md` | Already notes ≡ PRD 21 — keep |

## Implication

Mislabel is **numbering/docs**, not absence of onboarding code. Phase 21 Wave 0 finds a durable `CustomerOnboarding*` spine under tree-17. Work is harden + docs re-home — not greenfield and not Training/Adoption absorption.
