# Phase 17 — Customer Onboarding

> **MISLABELLED_PHASE / FUTURE_PHASE_SCOPE (PRD numbering)**  
> Relative to PRD `Inteligence & Leads.txt`, **Lead Conversion / Closed-Won is PRD Phase 20** (canonical code: tree phase-16 `lib/admin/crm/conversions/**`). This tree **phase-17** pack is **Customer Onboarding** and aligns with **PRD Phase 21** — **not** PRD Phase 20.  
> **Do not delete** this folder or `lib/admin/customerSuccess/onboarding/**`. Do not redefine PRD Phase 20 from this pack. See `docs/admin-intelligence-crm/phase-20/AUTHORITATIVE_ROADMAP_MAP.md`.

**Surface:** `/insightbooks/customer-success/onboarding` (+ requests, templates, queues, reports, settings; thin deep-links from conversion / CS customer)

**Architecture:** Approach 1 — dual-entity `CustomerOnboardingRequest` (`ONR-`) + `CustomerOnboardingProject` (`ONB-`) under `lib/admin/customerSuccess/onboarding/*`; reconcile Phase 8 `CsOnboardingRecord`; consume Phase 16 domain handoffs

**Design:** `docs/superpowers/specs/2026-07-31-customer-onboarding-phase-17-design.md`

**Plan:** `docs/superpowers/plans/2026-07-31-customer-onboarding-phase-17.md`

**Handoff in:** `docs/admin-intelligence-crm/phase-16/PHASE_17_INPUTS.md`

**Phase 16 exit:** `READY_FOR_PHASE_17_WITH_BLOCKERS`

**Wave 0 decision:** **CONDITIONAL GO** for Wave 1 — see `FINAL_READINESS_DECISION.md`

**Execution mode:** Subagent-Driven (chosen). Wave 1 may proceed after controller review of this pack.

## Wave status

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Forensic audits + matrices + readiness | Complete (2026-07-31) |
| 1 | Request/Project spine + numbering + state machines + handoff consume + idempotency | Not started |
| 2 | Templates/materialisation + kick-off (Phase 13) + stakeholders + tasks/evidence + scope/CR | Not started |
| 3 | Readiness coordination + migration/MRA/training coord + testing + go-live → stabilisation → handover → completion certificate | Not started |
| 4 | UI hubs + metrics/reliability + DQ/recon + reports/exports + Phase 8 migrate + Phase 18 pack | Not started |

## Hard rules

- Onboarding Handoff ≠ Onboarding Request ≠ Onboarding Project
- Onboarding ≠ Training ≠ Data Migration ≠ Support ≠ Customer Health
- Go-live ≠ Onboarding completion; Progress % ≠ completion
- Phase 16 handoff + accepted commercial snapshot are authoritative for Product/Plan/add-ons/quantities
- Scope mismatch → Change Request + commercial/subscription handoff — never silent entitlement escalation
- Customer Tasks require evidence (or authorised verified waiver); no fabricated Customer/Task/Milestone/migration/training/MRA/go-live/completion
- RSVP ≠ attendance; kick-off Meeting via Phase 13 or fail closed (`MEETING_SERVICE_UNAVAILABLE`)
- No direct OB/stock/Journal/AR/AP/tax posts; no MRA credentials fabrication; no unauthorised fiscal submit
- Training readiness ≠ Training completion (Phase 18 only); Migration upload alone ≠ complete; MRA/Training `UNKNOWN` ≠ READY
- Gate fail → never false zero; System CoA admin stays removed; Tenant CoA remains functional
- Customer portal = `CUSTOMER_PORTAL_NOT_CONFIGURED`
- Exact retry → existing Request/Project/materialisation/certificate; conflicting idempotency → fail visibly
- Expected phase exit (Wave 4): **READY_FOR_PHASE_18_WITH_BLOCKERS**

## Classification legend

| Class | Meaning |
|-------|---------|
| CORRECT_AND_REUSABLE | Keep as boundary / input; do not redefine |
| REUSE_WITH_RECONCILIATION | Reuse only with explicit mapping / honesty |
| EXTEND | Reuse and extend under onboarding domain |
| STANDARDISE | Align shapes/contracts across planes |
| CONSOLIDATE | Merge duplicated paths into one canonical |
| REFACTOR | Restructure without changing honesty contract |
| REIMPLEMENT | Replace unsafe/wrong implementation |
| DUPLICATED | Parallel truth exists — resolve |
| DISCONNECTED | Exists but not wired to canonical spine |
| WRONG_DOMAIN | Exists but belongs to another plane |
| WRONG_SOURCE | Wrong authoritative source |
| WRONG_SCOPE | Scope filter incorrect / too broad |
| CLIENT_SIDE_ONLY | UI-only; not server truth |
| NON_IDEMPOTENT | Exists but lacks onboarding-grade idempotency |
| UNVERSIONED | Missing version / checksum / immutability |
| UNRECONCILED | Missing recon to parent truth |
| CUSTOMER_ACTION_TRUTH_RISK | Risk of fabricating Customer action |
| TASK_COMPLETION_TRUTH_RISK | Risk of false task complete |
| MILESTONE_TRUTH_RISK | Risk of false milestone complete |
| MIGRATION_TRUTH_RISK | Risk of upload/import ≠ migration complete |
| TRAINING_TRUTH_RISK | Risk of readiness ≠ training complete |
| GO_LIVE_TRUTH_RISK | Risk of false go-live / READY from UNKNOWN |
| COMPLETION_TRUTH_RISK | Risk of false onboarding completion |
| CROSS_TENANT_RISK | Scope / isolation gap |
| CROSS_BUSINESS_RISK | Business isolation gap |
| CROSS_BRANCH_RISK | Branch isolation gap |
| CUSTOMER_PORTFOLIO_RISK | CS portfolio scope gap |
| CONTACT_PRIVACY_RISK | Contact PII exposure risk |
| FILE_SECURITY_RISK | Migration/doc file security gap |
| PERFORMANCE_RISK | Scale / N+1 / cache risk |
| REMOVE_AFTER_MIGRATION | Legacy after Project link |
| BLOCKED | Cannot proceed until dependency cleared |
| NOT_APPLICABLE | Out of onboarding plane |
| NOT_FOUND | Absent in codebase / schema |
| NOT_AVAILABLE | Explicitly deferred with typed contract |
| FORBIDDEN | Must not be used / invented for this phase |

## Pack index

- Scope / validation: `PHASE_17_SCOPE.md`, `PHASE_INPUT_VALIDATION.md`
- CURRENT_* domain audits + `ONBOARDING_*` DQ/privacy/security/performance/recon
- Matrices: `ONBOARDING_*_MATRIX.md`
- Gaps / plan / readiness: `PHASE_17_GAP_REGISTER.md`, `IMPLEMENTATION_PLAN.md`, `FINAL_READINESS_DECISION.md`
- Full phase exit report deferred to Wave 4 (`FINAL_PHASE_17_REPORT.md`)
