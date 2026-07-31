# Phase 20 — Lead Conversion / Closed-Won (PRD)

**Authoritative scope:** PRD Phase 20 — Lead Conversion and Closed-Won Workflow (CRM)  
**Surface:** `/insightbooks/crm/conversions` (+ overview, my-work, queues, duplicate-review, requests; optional thin `/crm/closed-won/*` aliases)  
**Architecture:** Approach 1 — extend existing `CrmConversion*` + `lib/admin/crm/conversions/**` (tree **phase-16** ≡ this PRD phase). **No** parallel `SalesConversion*` domain.  
**Design:** `docs/superpowers/specs/2026-07-31-lead-conversion-closed-won-phase-20-design.md`  
**Plan:** `docs/superpowers/plans/2026-07-31-lead-conversion-closed-won-phase-20.md`  
**Code alias (canonical):** Tree `docs/admin-intelligence-crm/phase-16/` + `lib/admin/crm/conversions/**`  
**Docs home (this pack):** `docs/admin-intelligence-crm/phase-20/`

**Wave 0 decision:** **CONDITIONAL GO** for Wave 1 — see `FINAL_READINESS_DECISION.md`

**Execution mode:** Not chosen yet — user picks Subagent-Driven (recommended) or Inline after CONDITIONAL GO. **No Wave 1 application code until then.**

## Phase-label correction (read first)

| PRD | Content | Tree folder today | Status for this pack |
|-----|---------|-------------------|----------------------|
| **20** | Lead Conversion / Closed-Won | **phase-16** conversion | **This phase** — harden + docs re-home |
| 21 | Customer Onboarding | **phase-17** CS | `FUTURE_PHASE_SCOPE` / `MISLABELLED_PHASE` — quarantine, do not delete |
| 22+ | Training / Adoption | **phase-18/19** CS | Quarantine; preserve code |
| — | Adoption `PHASE_20_INPUTS.md` (CS renewals) | phase-19 | **Not** PRD Phase 20 — non-authoritative for this work |

## Wave status

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Forensic audits + roadmap/compatibility/mislabel maps + readiness | Complete (2026-07-31) |
| 1 | Closed-Won readiness / acceptance / authority / approvals harden | Not started |
| 2 | Conversion saga idempotency / snapshot immutability / customer-contact duplicates | Complete (WORKING_TREE) |
| 3 | Request honesty + onboarding handoff checksum/idempotency/supersession | Not started |
| 4 | UI queues/metrics/DQ/recon/exports + Phase 21 pack + exit | Not started |

## Hard rules

- Lead ≠ CRM Account ≠ Platform Customer ≠ Tenant ≠ Business ≠ Branch
- Opportunity ≠ Conversion; Closed-Won ≠ Conversion completion; Conversion ≠ Onboarding
- Acceptance ≠ Payment ≠ Subscription ACTIVE; request ≠ result; handoff ≠ Onboarding Project
- UNKNOWN readiness ≠ READY; expired/superseded commercial cannot convert
- Exact retries must not duplicate Conversion / snapshot / Customer / Contact / requests / handoffs / certificates
- No fabricated acceptance/approval/Customer/Tenant/Subscription ACTIVE/entitlement/invitation/handoff/onboarding completion
- No Tenant GL / billing SoT change / MRA fiscal submission; no secrets in notes/exports
- Gate fail → never false zero; System CoA stays removed
- Sales-team / territory / customer / tenant fail-closed on list/search/export/metrics/writes-by-id
- Expected phase exit (Wave 4): **READY_FOR_PHASE_21_WITH_BLOCKERS**

## Classification legend

| Class | Meaning |
|-------|---------|
| CORRECT_AND_REUSABLE | Keep as boundary / SoT; do not redefine |
| REUSE_WITH_RECONCILIATION | Reuse with explicit mapping / honesty |
| EXTEND | Reuse and harden under conversion domain |
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

- Scope / maps: `PHASE_20_SCOPE.md`, `AUTHORITATIVE_ROADMAP_MAP.md`, `MISLABELLED_PHASE_ARTIFACT_AUDIT.md`, `PHASE_CONTENT_COMPATIBILITY_MAP.md`, `PHASE_INPUT_VALIDATION.md`
- CURRENT_* conversion audits + DQ/privacy/security/performance
- Gaps / plan / readiness: `PHASE_20_GAP_REGISTER.md`, `IMPLEMENTATION_PLAN.md`, `FINAL_READINESS_DECISION.md`
