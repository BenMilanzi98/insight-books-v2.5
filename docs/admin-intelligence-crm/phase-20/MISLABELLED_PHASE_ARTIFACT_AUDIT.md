# Mislabelled Phase Artifact Audit

**Audited:** 2026-07-31  
**Rule:** Banner / quarantine only — **DO NOT DELETE** CS or Demo/Commercial code.

## Summary

Tree phase numbers drifted from PRD `Inteligence & Leads.txt`. Closed-Won Conversion landed as tree **phase-16** while PRD places it at **Phase 20**. CS Onboarding/Training/Adoption occupied tree **17/18/19**, which PRD reserves for Activities→… and later Onboarding/Training. Adoption’s `PHASE_20_INPUTS` describes CS renewals — not Lead Conversion.

## Artifact table

| Artifact | Tree label | PRD reality | Classification | Action |
|----------|------------|-------------|----------------|--------|
| `docs/admin-intelligence-crm/phase-14/` Demo pack | Phase 14 | PRD 18 Demo | MISLABELLED_PHASE | Document; leave Demo code |
| `docs/admin-intelligence-crm/phase-15/` Commercial pack | Phase 15 | PRD 19 Proposal/Quotation | MISLABELLED_PHASE | Document; leave commercial code |
| `docs/admin-intelligence-crm/phase-16/` Conversion pack | Phase 16 | **PRD 20** Lead Conversion | CORRECT_AND_REUSABLE (code) + docs alias | Harden via `phase-20/`; keep phase-16 as historical alias |
| `lib/admin/crm/conversions/**` | Comments say Phase 16 | PRD 20 | CORRECT_AND_REUSABLE / EXTEND | Waves 1–4 harden; optional comment/contract phase bump Wave 4 |
| `docs/admin-intelligence-crm/phase-17/` CS Onboarding | Phase 17 | PRD 21 Onboarding | FUTURE_PHASE_SCOPE / MISLABELLED_PHASE | Banner; preserve `lib/admin/customerSuccess/onboarding/**` |
| `docs/admin-intelligence-crm/phase-18/` CS Training | Phase 18 | PRD 22 Training | FUTURE_PHASE_SCOPE / MISLABELLED_PHASE | Banner; preserve training lib |
| `docs/admin-intelligence-crm/phase-19/` CS Adoption | Phase 19 | PRD 22+ Adoption | FUTURE_PHASE_SCOPE / MISLABELLED_PHASE | Banner; preserve adoption lib |
| `phase-19/PHASE_20_INPUTS.md` | “Phase 20 Inputs” | CS renewals after Adoption | NON_AUTHORITATIVE | Do not drive PRD 20 conversion scope |
| `phase-19/PHASE_20_READINESS_CHECKLIST.md` | Phase 20 readiness | Renewals readiness | NON_AUTHORITATIVE | Ignore for conversion GO |
| `phase-16/PHASE_17_INPUTS.md` | Phase 17 inputs | Actually conversion→CS onboarding handoff | REUSE_WITH_RECONCILIATION | Maps to **PRD 21** consumer contract |

## Code preserved (must not delete)

| Path | Domain |
|------|--------|
| `lib/admin/customerSuccess/onboarding/**` | CS Onboarding (FUTURE PRD 21) |
| `lib/admin/customerSuccess/training/**` | CS Training (FUTURE PRD 22) |
| `lib/admin/customerSuccess/adoption/**` | CS Adoption (FUTURE) |
| `lib/admin/crm/demos/**` | Demo (tree-14 / PRD 18) |
| `lib/admin/crm/commercial/**` | Commercial (tree-15 / PRD 19) |
| `lib/admin/crm/conversions/**` | Conversion (tree-16 / **PRD 20**) |

## Banner status

| README | Banner |
|--------|--------|
| `docs/admin-intelligence-crm/phase-17/README.md` | FUTURE/MISLABELLED vs PRD 20 — added Wave 0 |
| `docs/admin-intelligence-crm/phase-18/README.md` | FUTURE/MISLABELLED vs PRD 20 — added Wave 0 |
| `docs/admin-intelligence-crm/phase-19/README.md` | FUTURE/MISLABELLED vs PRD 20 — added Wave 0 |

## Forbidden responses to mislabel

- Renaming folders in-place to “fix” numbers without migration plan
- Deleting CS packs to “clear” Phase 20
- Treating Adoption renewals inputs as Closed-Won conversion requirements
- Creating a second conversion domain under a new name
