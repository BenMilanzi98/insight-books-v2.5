# Authoritative Roadmap Map — PRD ↔ Tree (Phase 21 lens)

**Source PRD:** `Inteligence & Leads.txt`  
**Audited:** 2026-07-31  
**Purpose:** Single map so PRD Phase 21 Customer Onboarding cannot be redefined by Training/Adoption packs or stale tree numbering.

| PRD phase | PRD title (roadmap) | Authoritative content location (tree / code) | Doc folder today | Classification |
|-----------|---------------------|-----------------------------------------------|------------------|----------------|
| 20 | Lead Conversion / Closed-Won | Tree **phase-16** `lib/admin/crm/conversions/**` | `phase-16/` + `phase-20/` | CORRECT_AND_REUSABLE upstream |
| **21** | **Customer Onboarding** | Tree **phase-17** `lib/admin/customerSuccess/onboarding/**`, `CustomerOnboarding*` | `phase-17/` + **this** `phase-21/` | **CORRECT_AND_REUSABLE code; docs re-home** |
| 22 | Customer Training | Tree **phase-18** `lib/admin/customerSuccess/training/**` | `phase-18/` | FUTURE_PHASE_SCOPE / MISLABELLED_PHASE |
| 22+ | Adoption / renewals (CS) | Tree **phase-19** `lib/admin/customerSuccess/adoption/**` | `phase-19/` | FUTURE_PHASE_SCOPE / MISLABELLED_PHASE |

## Onboarding spine (PRD 21 SoT)

| Artifact | Path |
|----------|------|
| Domain services | `lib/admin/customerSuccess/onboarding/**` (~55 modules; handoffConsume, requests, projects, templates, readiness/*, goLive, completion, training coord, metrics, DQ, recon, exports) |
| Prisma models | `prisma/schema.prisma` — `CustomerOnboardingRequest`, `CustomerOnboardingProject`, Template/Workstream/Milestone/Task/Checklist/Kickoff/Readiness/GoLive/Stabilisation/Handover/Completion*, … |
| UI | `app/insightbooks/customer-success/onboarding/**` (overview hubs, projects/[id] tabs, requests, templates, queues, reports) |
| API | `app/api/admin/customer-success/onboarding/**`, `onboarding-requests/**` |
| Prior tree tests | `test/systemAdmin.cs.onboardingWave{1..4}.test.js` |
| Phase 21 tests (planned) | `test/systemAdmin.cs.onboardingPhase21Wave{1..4}.test.js` |
| Prior tree exit | `docs/admin-intelligence-crm/phase-17/FINAL_READINESS_DECISION.md` → `READY_FOR_PHASE_18_WITH_BLOCKERS` (tree-label exit; ≡ onboarding plane ready-with-blockers) |
| Upstream conversion exit | `docs/admin-intelligence-crm/phase-20/FINAL_READINESS_DECISION.md` → `READY_FOR_PHASE_21_WITH_BLOCKERS` |

## Non-authoritative / quarantine labels

| Artifact | Claims | Truth for PRD 21 |
|----------|--------|------------------|
| Tree `phase-17/` folder number | “Phase 17” | **MISLABELLED_PHASE** vs PRD — content is Customer Onboarding ≡ PRD 21 |
| Tree `phase-18/` Training | Next after tree-17 onboarding | **FUTURE PRD 22** — do not absorb into Phase 21 |
| Tree `phase-19/` Adoption | CS adoption | **FUTURE** — quarantine; completion ≠ adoption |
| `phase-19/PHASE_20_INPUTS.md` | CS renewals | **NON_AUTHORITATIVE** for conversion and for onboarding Project create |
| Phase 20 PRD bullet “Create the onboarding project once” | Literal in conversion PRD | Project create is **PRD 21** responsibility; Phase 20 emits handoff only |

## Action rules

1. Harden **only** `CustomerOnboarding*` / `lib/admin/customerSuccess/onboarding/**` for PRD 21.
2. Do **not** delete Training (tree-18) or Adoption (tree-19) code or folders.
3. Do **not** start PRD 22 Training re-home until Phase 21 exit ratified.
4. Point all new forensic/exit docs at `docs/admin-intelligence-crm/phase-21/`.
5. Handoff ≠ Request ≠ Project ≠ Training Program — preserve across Waves 1–4.
