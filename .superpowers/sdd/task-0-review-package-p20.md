# Task 0 P20 review

AUTHORITATIVE_ROADMAP_MAP.md
CONVERSION_DATA_QUALITY_AUDIT.md
CONVERSION_PERFORMANCE_AUDIT.md
CONVERSION_PRIVACY_AUDIT.md
CONVERSION_SECURITY_AUDIT.md
CURRENT_ACCEPTANCE_AUDIT.md
CURRENT_APPROVAL_AUDIT.md
CURRENT_CLOSED_WON_AUDIT.md
CURRENT_COMMERCIAL_SNAPSHOT_AUDIT.md
CURRENT_CONVERSION_ARCHITECTURE_AUDIT.md
CURRENT_CUSTOMER_CONTACT_AUDIT.md
CURRENT_DUPLICATES_AUDIT.md
CURRENT_EXPORTS_AUDIT.md
CURRENT_LEAD_OPPORTUNITY_CONVERSION_AUDIT.md
CURRENT_ONBOARDING_HANDOFF_AUDIT.md
CURRENT_PROVISIONING_AUDIT.md
CURRENT_RECON_AUDIT.md
CURRENT_REPORTS_AUDIT.md
CURRENT_SUBSCRIPTION_ENTITLEMENT_HANDOFF_AUDIT.md
FINAL_READINESS_DECISION.md
IMPLEMENTATION_PLAN.md
MISLABELLED_PHASE_ARTIFACT_AUDIT.md
PHASE_20_GAP_REGISTER.md
PHASE_20_SCOPE.md
PHASE_CONTENT_COMPATIBILITY_MAP.md
PHASE_INPUT_VALIDATION.md
README.md

===== AUTHORITATIVE_ROADMAP_MAP.md (excerpt) =====

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

## Action rules


===== PHASE_CONTENT_COMPATIBILITY_MAP.md (excerpt) =====

# Phase Content Compatibility Map — PRD 20 Lead Conversion

**Audited:** 2026-07-31  
**Legend:** READY | PARTIAL | GAP | CORRECT_AND_REUSABLE | EXTEND | FOUNDATION | MISLABELLED_PHASE | FUTURE_PHASE_SCOPE | NON_AUTHORITATIVE | NOT_FOUND | FORBIDDEN

## Domain surfaces

| Surface | Path(s) | Status | Class | Notes |
|---------|---------|--------|-------|-------|
| Conversion orchestrator | `lib/admin/crm/conversions/orchestrator.js` | PARTIAL | EXTEND | Exact retry + resume present; harden conflicting hashes / readiness gates |
| Conversion catalogue / contract | `catalogue.js` (`phase: 16`) | PARTIAL | EXTEND | Bump phase label Wave 4; honesty flags good |
| Request spine | `requests.js`, Prisma `CrmConversionRequest` | READY | CORRECT_AND_REUSABLE | CVR numbering + status machine |
| Readiness (conversion wrap) | `readiness.js` | PARTIAL | EXTEND | Soft-allows missing acceptance; UNKNOWN status not in enum |
| Closed-Won commercial readiness | `lib/admin/crm/commercial/readiness.js` | PARTIAL | EXTEND | Version/checksum/authority; expired/superseded version check weak |
| Opp close | `lib/admin/crm/opportunities/close.js` | READY | CORRECT_AND_REUSABLE | `assertNoProvision`; no side effects on close alone |
| Opp conversion readiness | `opportunities/conversionReadiness.js` | READY | CORRECT_AND_REUSABLE | Soft checklist; never provisions |
| Steps / idempotency | `steps.js` | PARTIAL | EXTEND | Wave1–4 steps; deepen snapshot lock + concurrency |
| Customer match | `customerMatch.js` | PARTIAL | EXTEND | No auto-merge; POSSIBLE blocks; EXACT_MATCH policy harden Wave 2 |
| Customer provision | `customerProvision.js` | PARTIAL | EXTEND | Create/link audited |
| Contact link | `businessBranch.js` `linkContactsForConversion` | PARTIAL | EXTEND | Cross-Customer deny + consent harden |
| Tenant / branch | `tenantProvision.js`, `businessBranch.js` | PARTIAL | EXTEND | Isolation assert; reserved slugs |
| Subscription / entitlements | `subscription.js`, `entitlements.js` | PARTIAL | EXTEND | Snapshot-driven; Closed Won ≠ ACTIVE |
| Billing / payment / activation | `billing.js`, `paymentBoundary.js`, `activation.js` | PARTIAL | EXTEND | Initiation ≠ PAID; AFTER_PAYMENT fail-closed |
| Onboarding handoff | `onboardingHandoff.js`, `handoffShared.js` | PARTIAL | EXTEND | Idempotent; forces `onboardingCompleted: false`; supersession/one-active deepen Wave 3 |
| Training/Migration/MRA handoffs | `*Handoff.js` | READY | CORRECT_AND_REUSABLE | Handoff ≠ execute |
| Completion certificate | `completion.js` | READY | CORRECT_AND_REUSABLE | Checksum; never deletes acceptance |
| Reports / metrics / gate | `reports.js`, `metrics.js`, `reliabilityGate.js` | PARTIAL | EXTEND | Gate → null/UNAVAILABLE; scope stub CARRY |
| DQ / recon | `dataQuality.js`, `reconciliation.js` | PARTIAL | EXTEND | Present; deepen Wave 4 |
| Exports module | — | GAP | NOT_FOUND | No `exports.js` under conversions — Wave 4 |
| Thin UI hubs | `app/insightbooks/crm/conversions/**` | PARTIAL | FOUNDATION | Overview/my-work/queues/requests/duplicate-review |
| Conversion APIs | `app/api/admin/crm/conversions/**` | PARTIAL | FOUNDATION | List + duplicate-review; expand as needed |
| Closed-won UI aliases | `/crm/closed-won/*` | GAP | NOT_FOUND | Optional thin aliases Wave 4 |
| CS Onboarding Project create from conversion | — | FORBIDDEN | FUTURE_PHASE_SCOPE | Must remain false in Phase 20 |
| Adoption PHASE_20_INPUTS | `phase-19/PHASE_20_INPUTS.md` | N/A | NON_AUTHORITATIVE | CS renewals |

## Compatibility classifications (rollup)

| Upstream / peer | Class for PRD 20 |
|-----------------|------------------|
| Tree phase-16 conversion exit + code | CORRECT_AND_REUSABLE / EXTEND |

===== MISLABELLED_PHASE_ARTIFACT_AUDIT.md (excerpt) =====

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

===== PHASE_20_GAP_REGISTER.md (excerpt) =====

# Phase 20 Gap Register

**Audited:** 2026-07-31  
**Inputs:** Wave 0 CURRENT_* audits, compatibility map, design/plan, tree phase-16 spine

| ID | Gap | Severity | Wave | Notes |
|----|-----|----------|------|-------|
| G20-01 | Conversion readiness soft-passes when acceptance missing (handoff pin) | CRITICAL | 1 | `conversions/readiness.js` |
| G20-02 | No `UNKNOWN` readiness status; UNKNOWN≠READY not enforced | CRITICAL | 1 | Extend `CRM_CONVERSION_READINESS_STATUS` |
| G20-03 | Expired / superseded commercial version not hard-blocked | CRITICAL | 1 | `commercial/readiness.js` + conversion wrap |
| G20-04 | Authority presence ≠ VERIFIED; UNKNOWN/VERIFICATION_REQUIRED must block | CRITICAL | 1 | Acceptance authority enum harden |
| G20-05 | View/open/silence must never count as acceptance (prove + harden) | HIGH | 1 | Vitest + commercial path |
| G20-06 | Unapproved discount / required approvals SoD not enforced on Closed-Won | HIGH | 1 | Approvals plane → readiness |
| G20-07 | Exact Closed-Won/conversion retry conflicting idempotency edges | HIGH | 1–2 | Orchestrator + close |
| G20-08 | Commercial snapshot not immutably locked post Closed-Won | CRITICAL | 2 | Lock + checksum; no silent Proposal mutate |
| G20-09 | EXACT_MATCH Customer must block auto-create; LINK_EXISTING harden | CRITICAL | 2 | `customerMatch.js` / provision |
| G20-10 | Contact duplicate / cross-Customer deny / consent | HIGH | 2 | `linkContactsForConversion` |
| G20-11 | Optimistic concurrency / step resume without duplicate downstream creates | HIGH | 2 | Steps + resources |
| G20-12 | Request status may imply ACTIVATED/PROVISIONED without provider result | CRITICAL | 3 | Wave 3 honesty |
| G20-13 | Onboarding handoff one-active + supersession history incomplete | CRITICAL | 3 | `handoffShared.js` / onboarding |
| G20-14 | Handoff package checksum + pending-provisioning labels | HIGH | 3 | Phase 21 contract |
| G20-15 | Secrets in handoff/notes risk | HIGH | 3–4 | Strip credentials |
| G20-16 | Conversion exports module missing | HIGH | 4 | PDF/XLSX/CSV + PII projection |
| G20-17 | Portfolio/team/territory fail-closed on list/search/export/metrics | HIGH | 4 | `resolveCrmScope` CARRY |
| G20-18 | UI queues / closed-won aliases / metrics label (≠ Revenue) polish | MEDIUM | 4 | Thin hubs OK; aliases optional |
| G20-19 | Domain contract still `phase: 16` | MEDIUM | 4 | Docs + catalogue bump |
| G20-20 | Phase 21 input pack + exit WITH_BLOCKERS | HIGH | 4 | Exit docs |
| G20-21 | Payment / e-sign providers | CARRY | — | Typed NOT_CONFIGURED |
| G20-22 | Prisma EPERM Windows | CARRY | All | SQL + `hasCrm*Model` |
| G20-23 | CS onboarding/training/adoption redefine Phase 20 | FORBIDDEN | — | Quarantine banners only |
| G20-24 | Adoption `PHASE_20_INPUTS` as conversion scope | FORBIDDEN | — | NON_AUTHORITATIVE |
| G20-25 | Parallel `SalesConversion*` domain | FORBIDDEN | — | Never |
| G20-26 | Create Onboarding Project from Phase 20 | FORBIDDEN | — | Handoff only |
| G20-27 | Tenant GL / MRA fiscal / invent zeroes | FORBIDDEN | — | Preserve |

**Wave 0 blocker count for CONDITIONAL GO:** **0** Critical identity/domain blockers. Critical harden items are scheduled Waves 1–3 (expected).

**No TBD blocking Wave 1 after CONDITIONAL GO** — conversion spine CORRECT_AND_REUSABLE; Wave 1 is targeted readiness/acceptance/approval harden + Vitest.

===== PHASE_INPUT_VALIDATION.md (excerpt) =====

# Phase Input Validation — PRD Phase 20 Wave 0

**Validated:** 2026-07-31  
**Result:** **PASS** (with documented mislabel / carry blockers)

## Inputs checked

| Input | Expected | Evidence | Result |
|-------|----------|----------|--------|
| PRD Phase 20 definition | Lead Conversion / Won Workflow | `Inteligence & Leads.txt` lines ~1086–1116 | PASS |
| Design approved | Approach 1 + docs quarantine | `docs/superpowers/specs/2026-07-31-lead-conversion-closed-won-phase-20-design.md` | PASS |
| Plan Task 0 | Wave 0 forensic pack | `docs/superpowers/plans/2026-07-31-lead-conversion-closed-won-phase-20.md` Task 0 | PASS |
| Tree phase-16 conversion exit | Ready-with-blockers for CS onboarding | `docs/admin-intelligence-crm/phase-16/FINAL_READINESS_DECISION.md` = `READY_FOR_PHASE_17_WITH_BLOCKERS` | PASS |
| Canonical conversion code | `lib/admin/crm/conversions/**` exists | 38 modules; `executeClosedWonConversion` exported | PASS |
| Prisma `CrmConversion*` | Models present | `prisma/schema.prisma` ~13900+ | PASS |
| UI/API surfaces | Conversions hub | `app/insightbooks/crm/conversions/**`, `app/api/admin/crm/conversions/**` | PASS |
| Prior Vitest | Wave 1–4 conversion tests | `test/systemAdmin.crm.conversionWave{1..4}.test.js` | PASS (present) |
| Commercial Closed-Won readiness | Consumable | `lib/admin/crm/commercial/readiness.js` | PASS |
| Pipeline close | No provision on close | `close.js` `assertNoProvision` | PASS |
| CS tree 17–19 | Must not redefine Phase 20 | Onboarding/training/adoption libs intact | PASS — quarantine only |
| Adoption `PHASE_20_INPUTS` | Must be marked non-authoritative | `phase-19/PHASE_20_INPUTS.md` = CS renewals | PASS — classified NON_AUTHORITATIVE |

## Blocking failures

None for Wave 0 / Wave 1 start. No missing identity of conversion domain; no requirement to invent a second domain.

## Documented carries (do not block CONDITIONAL GO)

- Payment provider / e-sign `NOT_CONFIGURED` (typed)
- Prisma EPERM on Windows → SQL + `hasCrm*Model` guards
- `resolveCrmScope` stub / portfolio fail-closed deepen
- Rich `/closed-won/*` UI aliases optional
- CS onboarding/training/adoption remain FUTURE (not deleted)

## Decision feed

→ `FINAL_READINESS_DECISION.md` **CONDITIONAL GO** for Wave 1 after user chooses Subagent-Driven or Inline.
