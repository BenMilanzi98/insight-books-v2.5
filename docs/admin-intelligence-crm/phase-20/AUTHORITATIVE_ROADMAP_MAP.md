# Authoritative Roadmap Map — PRD ↔ Tree

**Source PRD:** `Inteligence & Leads.txt` (Phases 14–22+)  
**Audited:** 2026-07-31  
**Purpose:** Single map of PRD phase numbers to tree folders/code so Phase 20 work cannot be redefined by mislabelled CS packs.

| PRD phase | PRD title (roadmap) | Authoritative content location (tree / code) | Doc folder today | Classification |
|-----------|---------------------|-----------------------------------------------|------------------|----------------|
| 14 | CRM Foundation and Lead Capture | Earlier CRM phases (e.g. leads/accounts under `lib/admin/crm/`); not tree-14 Demo | Mixed earlier packs | REUSE_WITH_RECONCILIATION |
| 15 | Qualification | Earlier CRM qualification waves | Mixed earlier packs | REUSE_WITH_RECONCILIATION |
| 16 | Pipeline / stages | `lib/admin/crm/pipeline/**`, `opportunities/**` (~tree phase-12 docs) | ~phase-12 | REUSE_WITH_RECONCILIATION |
| 17 | Activities / calendar | Activities plane (~tree phase-13) | ~phase-13 | REUSE_WITH_RECONCILIATION |
| 18 | Demo | Tree **phase-14** `lib/admin/crm/demos/**` | `docs/.../phase-14/` | MISLABELLED_PHASE (tree≠PRD) |
| 19 | Proposal / Quotation | Tree **phase-15** `lib/admin/crm/commercial/**` | `docs/.../phase-15/` | MISLABELLED_PHASE (tree≠PRD) |
| **20** | **Lead Conversion and Won Workflow** | Tree **phase-16** `lib/admin/crm/conversions/**`, `CrmConversion*` | `docs/.../phase-16/` + **this** `phase-20/` | **CORRECT_AND_REUSABLE code; docs re-home** |
| 21 | Onboarding Management | Tree **phase-17** `lib/admin/customerSuccess/onboarding/**` | `docs/.../phase-17/` | FUTURE_PHASE_SCOPE / MISLABELLED_PHASE |
| 22 | Customer Training Management | Tree **phase-18** `lib/admin/customerSuccess/training/**` | `docs/.../phase-18/` | FUTURE_PHASE_SCOPE / MISLABELLED_PHASE |
| 22+ | Adoption / renewals (CS) | Tree **phase-19** `lib/admin/customerSuccess/adoption/**` | `docs/.../phase-19/` | FUTURE_PHASE_SCOPE / MISLABELLED_PHASE |

## Conversion spine (PRD 20 SoT)

| Artifact | Path |
|----------|------|
| Domain services | `lib/admin/crm/conversions/**` (38 modules; orchestrator, readiness, steps, match, provision, handoffs, metrics, DQ, recon, reports) |
| Prisma models | `prisma/schema.prisma` — `CrmConversionRequest`, `CrmConversion`, `CrmConversionStep`, `CrmConversionDomainHandoff`, … |
| UI | `app/insightbooks/crm/conversions/{page,overview,my-work,queues,requests,duplicate-review}/page.js` |
| API | `app/api/admin/crm/conversions/route.js`, `.../duplicate-review/route.js` |
| Tests | `test/systemAdmin.crm.conversionWave{1..4}.test.js` |
| Prior exit | `docs/admin-intelligence-crm/phase-16/FINAL_READINESS_DECISION.md` → `READY_FOR_PHASE_17_WITH_BLOCKERS` |

## Non-authoritative “Phase 20” labels

| Artifact | Claims | Truth for PRD 20 |
|----------|--------|------------------|
| `docs/admin-intelligence-crm/phase-19/PHASE_20_INPUTS.md` | CS renewals / expansion execute after Adoption | **NON_AUTHORITATIVE** — CS renewals, not Lead Conversion |
| `docs/admin-intelligence-crm/phase-19/FINAL_READINESS_DECISION.md` | `READY_FOR_PHASE_20_WITH_BLOCKERS` meaning Adoption→renewals | Mislabelled exit relative to PRD numbering; do not consume as conversion GO |
| Tree phase-17/18/19 READMEs (pre-banner) | Numbered as phases 17–19 CS | FUTURE vs PRD 20 — banners added |

## PRD wording reconciliation (onboarding project)

| PRD Phase 20 bullet (literal) | Wave 0 / Approach 1 truth | Authority |
|-------------------------------|---------------------------|-----------|
| “Create the onboarding project once.” (`Inteligence & Leads.txt` ~1103) | **Handoff-only in Phase 20.** Emit one canonical onboarding handoff (+ checksum / supersession). **Onboarding Project creation is FORBIDDEN here** and belongs to **FUTURE PRD-21** (tree phase-17 CS onboarding). Not overlooked — intentional reinterpretation. | Design `2026-07-31-lead-conversion-closed-won-phase-20-design.md` (§Phase 21 handoff / out-of-scope); `PHASE_20_SCOPE.md` (boundaries + out of scope); gap **G20-26** |

## Action rules

1. Harden **only** `CrmConversion*` / conversions lib for PRD 20.
2. Do **not** delete CS onboarding/training/adoption code or folders.
3. Do **not** start PRD 21 onboarding re-home until Phase 20 exit ratified.
4. Point all new forensic/exit docs at `docs/admin-intelligence-crm/phase-20/`.
5. Do **not** create CS Onboarding Projects from Phase 20 — handoff only (see reconciliation row + G20-26).
