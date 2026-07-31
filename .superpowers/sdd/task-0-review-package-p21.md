# Task 0 P21 review

AUTHORITATIVE_ROADMAP_MAP.md
CURRENT_ONBOARDING_ARCHITECTURE_AUDIT.md
CURRENT_ONBOARDING_BUSINESS_BRANCH_READINESS_AUDIT.md
CURRENT_ONBOARDING_CHECKLIST_AUDIT.md
CURRENT_ONBOARDING_COMPLETION_AUDIT.md
CURRENT_ONBOARDING_CONFIG_READINESS_AUDIT.md
CURRENT_ONBOARDING_CUTOVER_AUDIT.md
CURRENT_ONBOARDING_ENTITLEMENT_READINESS_AUDIT.md
CURRENT_ONBOARDING_EXPORTS_AUDIT.md
CURRENT_ONBOARDING_GO_LIVE_AUDIT.md
CURRENT_ONBOARDING_HANDOFF_CONSUMPTION_AUDIT.md
CURRENT_ONBOARDING_HANDOVER_AUDIT.md
CURRENT_ONBOARDING_INTEGRATION_COORDINATION_AUDIT.md
CURRENT_ONBOARDING_KICKOFF_AUDIT.md
CURRENT_ONBOARDING_MIGRATION_COORDINATION_AUDIT.md
CURRENT_ONBOARDING_MILESTONE_AUDIT.md
CURRENT_ONBOARDING_MRA_COORDINATION_AUDIT.md
CURRENT_ONBOARDING_PROJECT_AUDIT.md
CURRENT_ONBOARDING_PROVISIONING_READINESS_AUDIT.md
CURRENT_ONBOARDING_REPORTS_AUDIT.md
CURRENT_ONBOARDING_REQUIREMENT_AUDIT.md
CURRENT_ONBOARDING_STABILISATION_AUDIT.md
CURRENT_ONBOARDING_SUBSCRIPTION_READINESS_AUDIT.md
CURRENT_ONBOARDING_TASK_AUDIT.md
CURRENT_ONBOARDING_TEMPLATE_AUDIT.md
CURRENT_ONBOARDING_TESTING_AUDIT.md
CURRENT_ONBOARDING_TRAINING_COORDINATION_AUDIT.md
CURRENT_ONBOARDING_USER_ACCESS_READINESS_AUDIT.md
CURRENT_ONBOARDING_WORKSTREAM_AUDIT.md
FINAL_READINESS_DECISION.md
IMPLEMENTATION_PLAN.md
MISLABELLED_ONBOARDING_ARTIFACT_AUDIT.md
ONBOARDING_COMPATIBILITY_MAP.md
ONBOARDING_DATA_QUALITY_AUDIT.md
ONBOARDING_PERFORMANCE_AUDIT.md
ONBOARDING_PRIVACY_AUDIT.md
ONBOARDING_RECONCILIATION_AUDIT.md
ONBOARDING_SECURITY_AUDIT.md
PHASE_21_GAP_REGISTER.md
PHASE_21_SCOPE.md
PHASE_INPUT_VALIDATION.md
README.md

===== AUTHORITATIVE_ROADMAP_MAP.md (excerpt) =====

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

===== ONBOARDING_COMPATIBILITY_MAP.md (excerpt) =====

# Onboarding Compatibility Map — PRD 21 Customer Onboarding

**Audited:** 2026-07-31  
**Legend:** READY | PARTIAL | GAP | CORRECT_AND_REUSABLE | EXTEND | FOUNDATION | MISLABELLED_PHASE | FUTURE_PHASE_SCOPE | NON_AUTHORITATIVE | NOT_FOUND | FORBIDDEN

## Domain surfaces

| Surface | Path(s) | Status | Class | Notes |
|---------|---------|--------|-------|-------|
| Domain contract / catalogue | `catalogue.js` (`phase` still tree-17) | PARTIAL | EXTEND | Honesty flags good; bump PRD phase label Wave 4 |
| Handoff consume | `handoffConsume.js` | PARTIAL | EXTEND | Idempotent Request create; **no** `acceptOnboardingHandoff` + checksum validate yet |
| Phase 20 handoff emit | `lib/admin/crm/conversions/onboardingHandoff.js`, `handoffShared.js` | READY | CORRECT_AND_REUSABLE | Checksum + one-active + supersession; handoff ≠ Project |
| Request spine | `requests.js`, Prisma `CustomerOnboardingRequest` | READY | CORRECT_AND_REUSABLE / EXTEND | ONR numbering + status machine; deepen accept path |
| Project spine | `projects.js`, Prisma `CustomerOnboardingProject` | PARTIAL | EXTEND | ONB- + template pin + idempotency; harden one-active / conflicting keys |
| Status machines | `status.js` | PARTIAL | EXTEND | Invalid transitions throw; deepen DRAFT→COMPLETED forbid edges |
| Templates / versions | `templates.js`, `templateVersions.js` | PARTIAL | EXTEND | ACTIVE immutable pattern; pin required on Project |
| Materialisation | `materialise.js` | PARTIAL | EXTEND | Workstreams/milestones/checklists/tasks once |
| Workstreams / milestones / checklists / tasks | `workstreams.js`, `milestones.js`, tasks models, `tasks.js` | PARTIAL | EXTEND | Evidence + SoD present; deepen |
| Kick-off | `kickoff.js` | PARTIAL | EXTEND | Phase 13 Meeting; RSVP ≠ attendance; fail closed |
| Requirements / scope / CR | `requirements.js`, `scope.js`, `changeRequests.js` | PARTIAL | EXTEND | Never silent entitlement mutate |
| Tenant readiness | `readiness/tenant.js` | PARTIAL | EXTEND | UNKNOWN when model unavailable |
| Business/branch readiness | `readiness/businessBranch.js` | PARTIAL | EXTEND | Pin honesty |
| User/access readiness | `readiness/users.js` | PARTIAL | EXTEND | Invitation ≠ ACCESS_VALID deepen |
| Config / accounting readiness | `readiness/configuration.js`, `readiness/accounting.js`, `accountingBoundary.js` | PARTIAL | EXTEND | No Tenant GL; subscription pin ≠ ACTIVE fabricate |
| Dedicated provisioning readiness | — | GAP | PARTIAL / NOT_FOUND module | Covered thinly via tenant pins; Wave 2 |
| Dedicated subscription/entitlement readiness | — | GAP | PARTIAL | Via configuration; Wave 2 honesty |
| Aggregate readiness | `readiness/evaluate.js` | PARTIAL | EXTEND | UNKNOWN ≠ READY; blocks go-live |
| Migration coordination | `migration.js` | PARTIAL | EXTEND | Engine NOT_AVAILABLE; recon gate |
| Training coordination | `training.js` | PARTIAL | EXTEND | COMPLETED requires Training-domain source |
| Phase 22 Training handoff package | — | GAP | NOT_FOUND | Wave 3 — checksum/idempotent emit |
| MRA EIS coordination | `mraEis.js` | PARTIAL | EXTEND | No fiscal/credentials |
| Integration coordination | — | GAP | NOT_FOUND | Wave 2–3 metadata readiness |
| Testing / defects | `testing.js`, `defects.js` | PARTIAL | EXTEND | Critical blocks go-live |
| Cutover | — | GAP | NOT_FOUND dedicated | Wave 3 coordinate with go-live |
| Go-live | `goLive.js` | PARTIAL | EXTEND | UNKNOWN blocks; SoD deepen |

===== MISLABELLED_ONBOARDING_ARTIFACT_AUDIT.md (excerpt) =====

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

===== PHASE_21_GAP_REGISTER.md (excerpt) =====

# Phase 21 Gap Register

**Audited:** 2026-07-31  
**Inputs:** Wave 0 CURRENT_* audits, compatibility map, design/plan, Phase 20 `PHASE_21_INPUTS.md`, tree phase-17 spine

| ID | Gap | Severity | Wave | Notes |
|----|-----|----------|------|-------|
| G21-01 | No `acceptOnboardingHandoff` with checksum validate; UNKNOWN ≠ VALID | CRITICAL | 1 | Emit has `computeOnboardingHandoffChecksum`; consume skips validate |
| G21-02 | Handoff accept idempotency / exact retry same; conflicting key fails | CRITICAL | 1 | Deepen beyond Request create idempotency |
| G21-03 | Correction/supersession preserves history on accept path | HIGH | 1 | Align with Phase 20 one-active handoff |
| G21-04 | Project create after accept; one active Project; conflicting idempotency fails | CRITICAL | 1 | `projects.js` present — harden edges |
| G21-05 | Invalid status transitions (DRAFT→COMPLETED, PLANNING→go-live complete) throw | HIGH | 1 | `status.js` EXTEND |
| G21-06 | Template pin required; ACTIVE immutable; materialise once | HIGH | 1–2 | Present — prove + harden |
| G21-07 | Provisioning readiness: REQUESTED/PROCESSING ≠ READY; no fabricated Tenant IDs | CRITICAL | 2 | Dedicated module thin/absent |
| G21-08 | Subscription readiness: ACTIVE only from authoritative service | CRITICAL | 2 | Via configuration pin today |
| G21-09 | Entitlement readiness: no unaccepted scope / UI term mutation | CRITICAL | 2 | CR path exists; deepen |
| G21-10 | Invitation sent ≠ ACCESS_VALID; no Platform Super Admin via onboarding | CRITICAL | 2 | `readiness/users.js` |
| G21-11 | Business/branch readiness fail-closed on writes-by-id | HIGH | 2 | `readiness/businessBranch.js` |
| G21-12 | Config readiness evidence-based; accounting via governed services only | HIGH | 2 | `accountingBoundary.js` EXTEND |
| G21-13 | Migration coordinate/reconcile only; no unsafe browser import | HIGH | 2–3 | `migration.js` |
| G21-14 | Integration coordination metadata + secrets redacted | HIGH | 2–3 | NOT_FOUND module |
| G21-15 | Go-live readiness UNKNOWN ≠ READY; Critical/High defects block | CRITICAL | 3 | `goLive.js` / `evaluate.js` present — harden |
| G21-16 | Go-live decision SoD; execution ≠ schedule; rollback preserves evidence | HIGH | 3 | Deepen approvals |
| G21-17 | Cutover coordination distinct from go-live success | HIGH | 3 | NOT_FOUND dedicated |
| G21-18 | Completion requires go-live + stabilisation + acceptances + CS handover + recon | CRITICAL | 3 | `completion.js` present — prove gaps |
| G21-19 | Certificate checksum idempotent; COMPLETED_WITH_GAPS explicit | HIGH | 3 | Present — harden |
| G21-20 | CS handover checksum/idempotent; does not overwrite Customer Health | HIGH | 3 | `handover.js` |
| G21-21 | Phase 22 Training handoff package checksum/idempotent; never create Programs | CRITICAL | 3 | NOT_FOUND — `training.js` is coord only |
| G21-22 | Training coordination COMPLETED still requires Training-domain source | HIGH | 3 | Preserve `training.js` gate |
| G21-23 | Reliability gate never false zero; scopes fail-closed | HIGH | 4 | `reliabilityGate.js` / `listScope.js` |
| G21-24 | Search/export/DQ/recon fail-closed + PII projection | HIGH | 4 | Present — deepen |
| G21-25 | Progress ≠ readiness ≠ completion; completion ≠ adoption | HIGH | 4 | Labels + metrics honesty |
| G21-26 | Domain contract / hub keys PRD phase 21 label | MEDIUM | 4 | Still tree-17 labels |
| G21-27 | Phase 22 input pack + FINAL report + exit WITH_BLOCKERS | HIGH | 4 | `PHASE_22_INPUTS.md` |
| G21-28 | Vitest Phase 21 Waves 1–4 | HIGH | 1–4 | New or extend onboardingWave* |

===== PHASE_INPUT_VALIDATION.md (excerpt) =====

# Phase Input Validation — PRD Phase 21 Wave 0

**Validated:** 2026-07-31  
**Result:** **PASS** (with documented mislabel / carry blockers)

## Inputs checked

| Input | Expected | Evidence | Result |
|-------|----------|----------|--------|
| PRD Phase 21 definition | Customer Onboarding Management | `Inteligence & Leads.txt` + design §1 | PASS |
| Design approved | Approach 1 + docs quarantine | `docs/superpowers/specs/2026-07-31-customer-onboarding-phase-21-design.md` | PASS |
| Plan Task 0 | Wave 0 forensic pack | `docs/superpowers/plans/2026-07-31-customer-onboarding-phase-21.md` Task 0 | PASS |
| Phase 20 exit | `READY_FOR_PHASE_21_WITH_BLOCKERS` | `docs/admin-intelligence-crm/phase-20/FINAL_READINESS_DECISION.md` | PASS |
| Phase 21 inputs pack | Handoff contract + honesty gates | `docs/admin-intelligence-crm/phase-20/PHASE_21_INPUTS.md` | PASS |
| Tree phase-17 onboarding exit | Spine delivered with blockers | `phase-17/FINAL_READINESS_DECISION.md` = `READY_FOR_PHASE_18_WITH_BLOCKERS` | PASS — tree-label exit; code reusable |
| Canonical onboarding code | `lib/admin/customerSuccess/onboarding/**` | 55 modules incl. handoffConsume, projects, goLive, completion | PASS |
| Prisma `CustomerOnboarding*` | Models present | `prisma/schema.prisma` Request/Project/Template/…/CompletionCertificate | PASS |
| UI/API surfaces | Onboarding hubs | `app/insightbooks/customer-success/onboarding/**`, `app/api/admin/customer-success/onboarding*/**` | PASS |
| Prior Vitest | Wave 1–4 onboarding tests | `test/systemAdmin.cs.onboardingWave{1..4}.test.js` | PASS (present) |
| Phase 20 handoff emit | Checksummed; ≠ Project | `onboardingHandoff.js` / `handoffShared.js` | PASS |
| Training tree-18 | Must not redefine Phase 21 | `lib/admin/customerSuccess/training/**` intact | PASS — quarantine FUTURE PRD 22 |
| Adoption tree-19 | Must not redefine Phase 21 | `lib/admin/customerSuccess/adoption/**` intact | PASS — quarantine FUTURE |
| Adoption `PHASE_20_INPUTS` | Non-authoritative | `phase-19/PHASE_20_INPUTS.md` | PASS — NON_AUTHORITATIVE |
| Handoff ≠ Project | Phase 20 does not create ONB Project | Phase 20 scope G20-26; consume creates Request only | PASS |

## Blocking failures

None for Wave 0 / Wave 1 start. Onboarding domain identity is clear; no requirement to invent a second domain; Phase 20 exit is honest WITH_BLOCKERS.

## Documented carries (do not block CONDITIONAL GO)

- Payment provider / e-sign `NOT_CONFIGURED` (typed from Phase 20)
- Customer portal `CUSTOMER_PORTAL_NOT_CONFIGURED`
- Migration engine / MRA fiscal / full Training delivery NOT_AVAILABLE
- Prisma EPERM on Windows → SQL + `hasCustomerOnboarding*Model` guards
