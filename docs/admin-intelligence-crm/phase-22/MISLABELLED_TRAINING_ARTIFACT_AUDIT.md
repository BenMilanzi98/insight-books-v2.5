# Mislabelled Training Artifact Audit — PRD Phase 22

**Audited:** 2026-07-31  
**Rule:** Do not delete working Training/onboarding/Adoption/Demo code. Re-home docs to `phase-22/`; quarantine FUTURE packs.

| Artifact | Present label | Authoritative truth | Class | Action |
|----------|---------------|---------------------|-------|--------|
| `docs/admin-intelligence-crm/phase-18/**` | Phase 18 Customer Training | **PRD Phase 22** Customer Training | MISLABELLED_PHASE | Preserve; new forensics/exit in `phase-22/`; banner updated |
| `lib/admin/customerSuccess/training/**` | Comments/contracts say “Phase 18” (`catalogue.js` `phase: 18`) | PRD 22 SoT | CORRECT_AND_REUSABLE code / MISLABELLED_PHASE label | Harden in place; bump domain contract Wave 1/4 |
| `docs/superpowers/specs/2026-07-31-customer-training-phase-18-design.md` | phase-18 design | Alias of PRD 22 | MISLABELLED_PHASE / REUSE | Keep as alias; authoritative design is phase-22-design |
| `docs/superpowers/plans/2026-07-31-customer-training-phase-18.md` | phase-18 plan | Historical tree plan | MISLABELLED_PHASE | Historical; Phase 22 plan supersedes for Waves |
| `test/systemAdmin.cs.trainingWave{1..4}.test.js` | trainingWave | Tree-18 wave tests | CORRECT_AND_REUSABLE | Extend with Phase 22 gap cases |
| `phase-18/FINAL_READINESS_DECISION.md` | READY_FOR_PHASE_19_WITH_BLOCKERS | Tree exit after Training Waves 1–4 | REUSE_WITH_RECONCILIATION | Evidence spine exists; PRD exit target = READY_FOR_PHASE_23_WITH_BLOCKERS |
| `phase-18/PHASE_19_INPUTS.md` | Phase 19 Adoption inputs | Adoption = FUTURE CS (not PRD 23 Marketing) | MISLABELLED_PHASE / FUTURE | Preserve; do not treat as Phase 22 exit destination |
| `TRAINING_REQUEST_SOURCE.PHASE_16_TRAINING_HANDOFF` | Phase 16 source | Conversion TRAINING handoff ≡ PRD 20 plane | MISLABELLED relative to PRD 22 primary | Retarget aliases; Phase 21 handoff is primary |
| `TRAINING_REQUEST_SOURCE.PHASE_17_ONBOARDING_REQUIREMENT` | Phase 17 | Onboarding ≡ PRD 21 | MISLABELLED_PHASE numbering | Map → `PHASE_21_ONBOARDING_REQUIREMENT` |
| `onboardingFeed.js` `DOMAIN_SOURCE = 'PHASE_18_TRAINING'` | Phase 18 Training | PRD 22 Training domain | MISLABELLED_PHASE | Accept both; prefer `PHASE_22_TRAINING` |
| `lib/admin/crm/demos/**` | Could be confused with Training | **PRD 18 Demo** | CORRECT_AND_REUSABLE / WRONG_DOMAIN for Training | Preserve; never Demo→Training |
| `lib/admin/customerSuccess/onboarding/**` | Distinct from Training | **PRD 21** | CORRECT_AND_REUSABLE | Handoff emit only |
| `docs/admin-intelligence-crm/phase-19/**` + `adoption/**` | Phase 19 Adoption | FUTURE CS adoption | FUTURE_PHASE_SCOPE | Banner; do not delete; trained ≠ adopted |
| `phase-21/PHASE_22_INPUTS.md` | Phase 22 inputs | Authoritative consume contract | CORRECT_AND_REUSABLE | Wave 0 validated |

## Banner requirements (Wave 0)

| Pack | Banner must state |
|------|-------------------|
| Training `phase-18/README.md` | MISLABELLED vs PRD; ≡ **PRD 22**; docs re-home `phase-22/`; do not delete |
| Adoption `phase-19/` | FUTURE vs Training; do not redefine Training |
| Demo CRM demos | PRD 18 Demo — distinct from Training |

## Implication

Mislabel is **numbering/docs**, not absence of Training code. Phase 22 Wave 0 finds a durable `CustomerTraining*` spine under tree-18. Work is harden + docs re-home — not greenfield, not Demo absorption, not second domain.

