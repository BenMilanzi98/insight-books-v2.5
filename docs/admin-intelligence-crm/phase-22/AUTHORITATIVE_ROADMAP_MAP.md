# Authoritative Roadmap Map — PRD ↔ Tree (Phase 22 lens)

**Source PRD:** `Inteligence & Leads.txt`  
**Audited:** 2026-07-31

| PRD phase | PRD title | Authoritative content location | Doc folder today | Classification |
|-----------|-----------|--------------------------------|------------------|----------------|
| 18 | Demo Management | `lib/admin/crm/demos/**` | CRM Demo docs (not Training) | CORRECT_AND_REUSABLE — **distinct** |
| 20 | Lead Conversion / Closed-Won | Tree **phase-16** `lib/admin/crm/conversions/**` | `phase-16/` + `phase-20/` | CORRECT_AND_REUSABLE upstream |
| 21 | Customer Onboarding | Tree **phase-17** `lib/admin/customerSuccess/onboarding/**` | `phase-17/` + `phase-21/` | CORRECT_AND_REUSABLE — handoff emit |
| **22** | **Customer Training** | Tree **phase-18** `lib/admin/customerSuccess/training/**` | `phase-18/` + **this** `phase-22/` | **CORRECT_AND_REUSABLE code; docs re-home** |
| 23 | Marketing Attribution | Phase 23 pack (post-exit) | — | FUTURE_PHASE_SCOPE (exit target) |
| FUTURE CS | Adoption / renewals | Tree **phase-19** `lib/admin/customerSuccess/adoption/**` | `phase-19/` | FUTURE_PHASE_SCOPE / MISLABELLED_PHASE |

## Training spine (PRD 22 SoT)

| Artifact | Path |
|----------|------|
| Domain services | `lib/admin/customerSuccess/training/**` (~42 modules) |
| Prisma models | `prisma/schema.prisma` — `CustomerTrainingRequest` … `CustomerTrainingCertificate` (~15547–16081+) |
| UI | `app/insightbooks/customer-success/training/**` |
| API | `app/api/admin/customer-success/training-requests|training-programs|training-sessions` |
| Tree tests | `test/systemAdmin.cs.trainingWave{1..4}.test.js` |
| Prior tree exit | `phase-18/FINAL_READINESS_DECISION.md` → `READY_FOR_PHASE_19_WITH_BLOCKERS` (mislabelled next) |
| Upstream onboarding exit | `phase-21/FINAL_READINESS_DECISION.md` → `READY_FOR_PHASE_22_WITH_BLOCKERS` |

## Action rules

1. Harden **only** `CustomerTraining*` / `lib/admin/customerSuccess/training/**` for PRD 22.
2. Do **not** delete tree-18 Training pack or code; banner FUTURE/mislabel + point to `phase-22/`.
3. Do **not** convert Demo into Training; do **not** reimplement onboarding.
4. Point new forensic/exit docs at `docs/admin-intelligence-crm/phase-22/`.

