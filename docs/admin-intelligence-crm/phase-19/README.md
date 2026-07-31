# Phase 19 — Customer Adoption

> **MISLABELLED_PHASE / FUTURE_PHASE_SCOPE (PRD numbering)**  
> Relative to PRD `Inteligence & Leads.txt`, **Customer Onboarding is PRD Phase 21** (canonical code: tree phase-17 `lib/admin/customerSuccess/onboarding/**`; docs re-home `phase-21/`). **Lead Conversion / Closed-Won is PRD Phase 20** (tree phase-16). This tree **phase-19** pack is **Customer Adoption** (**FUTURE** vs PRD 21; PRD 22+) — **not** PRD Phase 20 and **not** PRD Phase 21.  
> In particular, `PHASE_20_INPUTS.md` here describes **CS renewals / expansion execute** and is **NON_AUTHORITATIVE** for PRD Phase 20 Lead Conversion and for onboarding Project create. Onboarding completion ≠ adoption.  
> **Do not delete** this folder or `lib/admin/customerSuccess/adoption/**`. Phase 21 must not absorb Adoption. See `docs/admin-intelligence-crm/phase-21/AUTHORITATIVE_ROADMAP_MAP.md` and `docs/admin-intelligence-crm/phase-20/AUTHORITATIVE_ROADMAP_MAP.md`.

**Surface:** `/insightbooks/customer-success/adoption` (+ overview, my-work, team, portfolio, attention, requests, plans, milestones, outcomes, champions, dormancy, interventions, expansion, reports, settings; thin deep-links from onboarding / training / CS customer)

**Architecture:** Approach 1 — dual-entity `CustomerAdoptionRequest` (`ADR-`) + `CustomerAdoptionPlan` (`ADP-`) under `lib/admin/customerSuccess/adoption/*`; reconcile Phase 8 Success Plans / Playbooks / Interventions; consume Phase 18 Training Program `COMPLETED` + Phase 17 onboarding handover attach; Phase 9 product-analytics as read-only evidence

**Design:** `docs/superpowers/specs/2026-07-31-customer-adoption-phase-19-design.md`

**Plan:** `docs/superpowers/plans/2026-07-31-customer-adoption-phase-19.md`

**Handoff in:** `docs/admin-intelligence-crm/phase-18/PHASE_19_INPUTS.md`

**Phase 18 exit:** `READY_FOR_PHASE_19_WITH_BLOCKERS`

**Wave 0 decision:** **CONDITIONAL GO** for Wave 1 — see `FINAL_READINESS_DECISION.md` (interim; full phase exit report deferred to Wave 4)

**Execution mode:** Not chosen yet — user picks Subagent-Driven (recommended) or Inline after CONDITIONAL GO. **No Wave 1 application code until then.**

## Wave status

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Forensic audits + matrices + readiness | Complete (2026-07-31) |
| 1 | Request/Plan spine + numbering + Training COMPLETED consume + manual + handover attach + status policy | Not started |
| 2 | Milestones / value outcomes + Phase 9 evidence + Plan completion evaluation | Not started |
| 3 | Champions / dormancy recovery / Phase 8 intervention links / expansion handoffs | Not started |
| 4 | UI hubs + metrics/reliability + DQ/recon + reports/exports + Phase 8 reconcile + Phase 20 pack | Not started |

## Hard rules

- Adoption Handoff/attach ≠ Adoption Request ≠ Adoption Plan ≠ Milestone ≠ Intervention ≠ Expansion execute
- Training Program `COMPLETED_WITH_GAPS` / partial participant completion ≠ auto Adoption Request; only aggregate `COMPLETED` auto-creates
- Onboarding Project COMPLETED / handover accepted ≠ Adoption Plan COMPLETED; attach only
- Phase 8 historical Success Plan / checklist COMPLETED ≠ Adoption Plan COMPLETED without linked Plan evidence
- Phase 9 gate fail / missing instrumentation → evidence `UNAVAILABLE` / milestone `UNKNOWN` — never invent MET or KPI zeroes
- Certificate / Training progress % ≠ product adoption; cert ≠ professional accreditation (Phase 18 carry)
- Expansion / renewal handoff ≠ mutate Subscription, Entitlement, Platform Invoice/Payment, or Tenant GL
- Interventions execute only via Phase 8 APIs; Adoption stores link + outcome attestation
- Exact retries must not duplicate Requests, Plans, milestone materialisation, dormancy cases, intervention links, or expansion handoffs
- Plan COMPLETED requires policy-defined critical milestones MET|WAIVED + value review sign-off — not “any milestone done”
- Dormancy recovery COMPLETED / RECOVERED requires usage-return snapshot and/or attested outreach — never auto-complete from signal absence
- System `/insightbooks/chart-of-accounts` stays removed; no Tenant GL from Adoption
- Reliability / metric gate fail → never fabricated zero
- Virtual provider / training portal / rich LMS banks / payment / e-sign remain typed unavailable (Phase 18 carry)
- Intelligence `customers/adoption` stub / CRM `FEATURE_USED not emitted` ≠ CS Adoption spine
- Expected phase exit (Wave 4): **READY_FOR_PHASE_20_WITH_BLOCKERS**

## Classification legend

| Class | Meaning |
|-------|---------|
| CORRECT_AND_REUSABLE | Keep as boundary / input; do not redefine |
| REUSE_WITH_RECONCILIATION | Reuse only with explicit mapping / honesty |
| EXTEND | Reuse and extend under Adoption domain |
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
| NON_IDEMPOTENT | Exists but lacks Adoption-grade idempotency |
| UNVERSIONED | Missing version / checksum / immutability |
| UNRECONCILED | Missing recon to parent truth |
| MILESTONE_TRUTH_RISK | Risk of false MET from empty analytics / cert |
| VALUE_TRUTH_RISK | Risk of false first-value / zero-as-success |
| PLAN_TRUTH_RISK | Risk of false Plan COMPLETED |
| DORMANCY_TRUTH_RISK | Risk of false RECOVERED from signal absence |
| EXPANSION_TRUTH_RISK | Risk of handoff executing billing/entitlement |
| ADOPTION_TRUTH_RISK | Risk of fabricating product adoption |
| CUSTOMER_ACTION_TRUTH_RISK | Risk of fabricating Customer action |
| CROSS_TENANT_RISK | Scope / isolation gap |
| CROSS_BUSINESS_RISK | Business isolation gap |
| CROSS_BRANCH_RISK | Branch isolation gap |
| CUSTOMER_PORTFOLIO_RISK | CS portfolio scope gap |
| CONTACT_PRIVACY_RISK | Contact PII exposure risk |
| PERFORMANCE_RISK | Scale / N+1 / cache risk |
| REMOVE_AFTER_MIGRATION | Legacy after Adoption Plan link |
| BLOCKED | Cannot proceed until dependency cleared |
| NOT_APPLICABLE | Out of Adoption plane |
| NOT_FOUND | Absent in codebase / schema |
| NOT_AVAILABLE | Explicitly deferred with typed contract |
| FORBIDDEN | Must not be used / invented for this phase |

## Pack index

- Scope / validation: `PHASE_19_SCOPE.md`, `PHASE_INPUT_VALIDATION.md`
- CURRENT_* domain audits + `ADOPTION_*` DQ/privacy/security/performance/recon
- Matrices: `ADOPTION_*_MATRIX.md`
- Gaps / plan / readiness: `PHASE_19_GAP_REGISTER.md`, `IMPLEMENTATION_PLAN.md`, `FINAL_READINESS_DECISION.md`
- Full phase exit report deferred to Wave 4 (`FINAL_PHASE_19_REPORT.md` / `PHASE_20_INPUTS.md`)
