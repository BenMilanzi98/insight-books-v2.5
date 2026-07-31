# Phase 20 Gap Register

**Audited:** 2026-07-31  
**Inputs:** Wave 0 CURRENT_* audits, compatibility map, design/plan, tree phase-16 spine

| ID | Gap | Severity | Wave | Notes |
|----|-----|----------|------|-------|
| G20-01 | Conversion readiness soft-passes when acceptance missing (handoff pin) | CRITICAL | 1 | **CLOSED** Wave 1 — handoff pin alone → UNKNOWN/not READY |
| G20-02 | No `UNKNOWN` readiness status; UNKNOWN≠READY not enforced | CRITICAL | 1 | **CLOSED** Wave 1 — `UNKNOWN` on conversion + commercial readiness |
| G20-03 | Expired / superseded commercial version not hard-blocked | CRITICAL | 1 | **CLOSED** Wave 1 — version status blockers in commercial readiness |
| G20-04 | Authority presence ≠ VERIFIED; UNKNOWN/VERIFICATION_REQUIRED must block | CRITICAL | 1 | **CLOSED** Wave 1 — `CRM_ACCEPTANCE_AUTHORITY_STATUS` |
| G20-05 | View/open/silence must never count as acceptance (prove + harden) | HIGH | 1 | **CLOSED** Wave 1 — `assertEngagementIsNotAcceptance` + accept deny |
| G20-06 | Unapproved discount / required approvals SoD not enforced on Closed-Won | HIGH | 1 | **CLOSED** Wave 1 — discount approval blockers on readiness |
| G20-07 | Exact Closed-Won/conversion retry conflicting idempotency edges | HIGH | 1–2 | **CLOSED** Wave 1+2 (exact retry + conflicting input hash fail) |
| G20-08 | Commercial snapshot not immutably locked post Closed-Won | CRITICAL | 2 | **CLOSED** Wave 2 — `commercialSnapshot.js` lock + checksum; draft edit ≠ mutate |
| G20-09 | EXACT_MATCH Customer must block auto-create; LINK_EXISTING harden | CRITICAL | 2 | **CLOSED** Wave 2 — EXACT_MATCH / LINK_EXISTING / CREATE_NEW + provision gate |
| G20-10 | Contact duplicate / cross-Customer deny / consent | HIGH | 2 | **CLOSED** Wave 2 — `decideContactCreateOrLink` + consent preserve |
| G20-11 | Optimistic concurrency / step resume without duplicate downstream creates | HIGH | 2 | **CLOSED** Wave 2 — `claimConversionStep` / resource replay |
| G20-12 | Request status may imply ACTIVATED/PROVISIONED without provider result | CRITICAL | 3 | **CLOSED** Wave 3 — `requestHonesty.js` + provision strip |
| G20-13 | Onboarding handoff one-active + supersession history incomplete | CRITICAL | 3 | **CLOSED** Wave 3 — one-active + correction supersede |
| G20-14 | Handoff package checksum + pending-provisioning labels | HIGH | 3 | **CLOSED** Wave 3 — checksum + pending labels |
| G20-15 | Secrets in handoff/notes risk | HIGH | 3–4 | **CLOSED** Wave 3 — sanitize; Wave 4 notes polish optional |
| G20-16 | Conversion exports module missing | HIGH | 4 | **CLOSED** Wave 4 — `exports.js` + PII strip + formula neutralise |
| G20-17 | Portfolio/team/territory fail-closed on list/search/export/metrics | HIGH | 4 | **CLOSED** Wave 4 — `listScope.js` sales-team/territory/customer/tenant |
| G20-18 | UI queues / closed-won aliases / metrics label (≠ Revenue) polish | MEDIUM | 4 | **CLOSED** Wave 4 — thin hubs + `/closed-won/*` aliases + valueLabels |
| G20-19 | Domain contract still `phase: 16` | MEDIUM | 4 | **CLOSED** Wave 4 — `phase: 20` |
| G20-20 | Phase 21 input pack + exit WITH_BLOCKERS | HIGH | 4 | **CLOSED** Wave 4 — READY_FOR_PHASE_21_WITH_BLOCKERS |
| G20-21 | Payment / e-sign providers | CARRY | — | Typed NOT_CONFIGURED |
| G20-22 | Prisma EPERM Windows | CARRY | All | SQL + `hasCrm*Model` |
| G20-23 | CS onboarding/training/adoption redefine Phase 20 | FORBIDDEN | — | Quarantine banners only |
| G20-24 | Adoption `PHASE_20_INPUTS` as conversion scope | FORBIDDEN | — | NON_AUTHORITATIVE |
| G20-25 | Parallel `SalesConversion*` domain | FORBIDDEN | — | Never |
| G20-26 | Create Onboarding Project from Phase 20 | FORBIDDEN | — | Handoff only |
| G20-27 | Tenant GL / MRA fiscal / invent zeroes | FORBIDDEN | — | Preserve |

**Wave 0 blocker count for CONDITIONAL GO:** **0** Critical identity/domain blockers. Critical harden items are scheduled Waves 1–3 (expected).

**No TBD blocking Wave 1 after CONDITIONAL GO** — conversion spine CORRECT_AND_REUSABLE; Wave 1 is targeted readiness/acceptance/approval harden + Vitest.
