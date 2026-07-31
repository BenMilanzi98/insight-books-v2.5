# Phase 21 — Customer Onboarding (PRD)

**Authoritative scope:** PRD Phase 21 — Customer Onboarding Management  
**Surface:** `/insightbooks/customer-success/onboarding` (+ overview, my-work, team, portfolio, calendar, queues, handoffs, projects, templates, go-live, stabilisation, completion, reports, settings)  
**Architecture:** Approach 1 — extend existing `CustomerOnboarding*` + `lib/admin/customerSuccess/onboarding/**` (tree **phase-17** ≡ this PRD phase). **No** parallel onboarding domain.  
**Design:** `docs/superpowers/specs/2026-07-31-customer-onboarding-phase-21-design.md`  
**Plan:** `docs/superpowers/plans/2026-07-31-customer-onboarding-phase-21.md`  
**Code alias (canonical):** Tree `docs/admin-intelligence-crm/phase-17/` + `lib/admin/customerSuccess/onboarding/**`  
**Docs home (this pack):** `docs/admin-intelligence-crm/phase-21/`  
**Upstream exit:** Phase 20 `READY_FOR_PHASE_21_WITH_BLOCKERS` (`docs/admin-intelligence-crm/phase-20/PHASE_21_INPUTS.md`)

**Exit decision:** **READY_FOR_PHASE_22_WITH_BLOCKERS** — see `FINAL_READINESS_DECISION.md`  
**Phase 22 pack:** `PHASE_22_INPUTS.md`, `PHASE_22_READINESS_CHECKLIST.md`, `FINAL_PHASE_21_REPORT.md`

**Execution mode:** Subagent-Driven. Waves 0–4 complete (WORKING_TREE).

## Phase-label correction (read first)

| PRD | Content | Tree folder today | Status for this pack |
|-----|---------|-------------------|----------------------|
| 20 | Lead Conversion / Closed-Won | **phase-16** + `phase-20/` docs | Upstream — consume handoffs |
| **21** | **Customer Onboarding** | **phase-17** CS onboarding | **This phase** — harden + docs re-home |
| 22 | Customer Training | **phase-18** CS training | `FUTURE_PHASE_SCOPE` — quarantine; handoff target only |
| 22+ | Adoption | **phase-19** CS adoption | `FUTURE_PHASE_SCOPE` — quarantine; do not absorb |

## Wave status

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Forensic audits + roadmap/compatibility/mislabel maps + readiness | Complete (2026-07-31) |
| 1 | Handoff validate/accept + Project spine harden | Complete |
| 2 | Readiness honesty + accounting boundary | Complete |
| 3 | Go-live / completion / CS handover / Phase 22 Training handoff | Complete |
| 4 | UI/metrics/DQ/recon/Phase 22 pack/exit | Complete — `READY_FOR_PHASE_22_WITH_BLOCKERS` |

## Hard rules

- Phase 20 Handoff ≠ Onboarding Request ≠ Onboarding Project ≠ Training Program
- Provisioning request ≠ result; Subscription request ≠ ACTIVE; invitation sent ≠ access validated
- Migration scope ≠ completion; Training requirement ≠ Training completion; go-live ≠ onboarding completion; completion ≠ adoption
- Exact retries must not duplicate handoff accept, Project, workstreams, milestones, Training handoffs, go-live decisions, certificates, CS handovers
- UNKNOWN readiness/validation ≠ READY/VALID
- No fabricated provision/ACTIVATED/Training/test/go-live/completion
- No Tenant GL / billing SoT / MRA fiscal; no secrets in notes/exports; gate fail → never false zero
- Portfolio/team/territory/tenant/business/branch fail-closed on list/search/export/metrics/writes-by-id
- Expected phase exit (Wave 4): **READY_FOR_PHASE_22_WITH_BLOCKERS**

## Classification legend

| Class | Meaning |
|-------|---------|
| CORRECT_AND_REUSABLE | Keep as boundary / SoT; do not redefine |
| REUSE_WITH_RECONCILIATION | Reuse with explicit mapping / honesty |
| EXTEND | Reuse and harden under onboarding domain |
| FOUNDATION | Present; needs Wave harden |
| PARTIAL | Works for happy path; Critical/High gaps remain |
| NOT_FOUND | Absent |
| MISLABELLED_PHASE | Numbered under wrong PRD phase |
| FUTURE_PHASE_SCOPE | Belongs to later PRD (preserve code) |
| WRONG_DOMAIN | Exists but wrong plane |
| NON_AUTHORITATIVE | Must not drive this phase’s scope |
| CARRY | Explicit blocker from prior phases |
| FORBIDDEN | Must not invent / use for this phase |

## Pack index

- Scope / maps: `PHASE_21_SCOPE.md`, `AUTHORITATIVE_ROADMAP_MAP.md`, `MISLABELLED_ONBOARDING_ARTIFACT_AUDIT.md`, `ONBOARDING_COMPATIBILITY_MAP.md`, `PHASE_INPUT_VALIDATION.md`
- CURRENT_* onboarding audits + DQ/privacy/security/performance
- Gaps / plan / readiness: `PHASE_21_GAP_REGISTER.md`, `IMPLEMENTATION_PLAN.md`, `FINAL_READINESS_DECISION.md`
