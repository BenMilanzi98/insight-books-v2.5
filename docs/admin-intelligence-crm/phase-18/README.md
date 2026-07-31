# Phase 18 — Customer Training

> **MISLABELLED_PHASE / code alias for PRD Phase 22**  
> Relative to PRD `Inteligence & Leads.txt`, this tree **phase-18** pack is **Customer Training** ≡ **PRD Phase 22** (canonical code remains `lib/admin/customerSuccess/training/**`). **Authoritative Phase 22 forensic/exit docs re-home to** `docs/admin-intelligence-crm/phase-22/`.  
> **Customer Onboarding is PRD Phase 21** (tree phase-17 / `phase-21/`). **Demo Management is PRD Phase 18** (`lib/admin/crm/demos/**`) — **distinct; never Demo→Training**. **Adoption** (tree phase-19) remains **FUTURE_PHASE_SCOPE** — trained ≠ adopted.  
> **Do not delete** this folder or `lib/admin/customerSuccess/training/**`. Do not create a second Training domain. See `docs/admin-intelligence-crm/phase-22/AUTHORITATIVE_ROADMAP_MAP.md` and `docs/admin-intelligence-crm/phase-22/MISLABELLED_TRAINING_ARTIFACT_AUDIT.md`.

**Surface:** `/insightbooks/customer-success/training` (+ requests, programs, cohorts, sessions, participants, trainers, curricula, assessments, certificates, reports, settings; thin deep-links from onboarding / conversion / CS customer)

**Architecture:** Approach 1 — dual-entity `CustomerTrainingRequest` (`TRQ-`) + `CustomerTrainingProgram` (`TRN-`) under `lib/admin/customerSuccess/training/*`; reconcile Phase 8 `CsTrainingRecord`; consume Phase 16 Training handoffs + Phase 17 training coordination

**Design:** `docs/superpowers/specs/2026-07-31-customer-training-phase-18-design.md`

**Plan:** `docs/superpowers/plans/2026-07-31-customer-training-phase-18.md`

**Handoff in:** `docs/admin-intelligence-crm/phase-17/PHASE_18_INPUTS.md`

**Phase 17 exit:** `READY_FOR_PHASE_18_WITH_BLOCKERS`

**Wave 0 decision:** **CONDITIONAL GO** for Wave 1 — see `FINAL_READINESS_DECISION.md`

**Execution mode:** Subagent-Driven (chosen). Wave 1 may proceed after controller review of this pack.

## Wave status

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Forensic audits + matrices + readiness | Complete (2026-07-31) |
| 1 | Request/Program spine + numbering + curricula seed + handoff consume + idempotency | Not started |
| 2 | Participants/trainers/cohorts + Sessions (Phase 13) + conflicts + attendance + materials/env | Not started |
| 3 | Exercises/assessments/completion/certificates + Phase 17 feed | Not started |
| 4 | UI hubs + metrics/reliability + DQ/recon + reports/exports + Phase 8 migrate + Phase 19 pack | Done 2026-07-31 |

## Hard rules

- Training Handoff ≠ Training Request ≠ Training Program ≠ Cohort ≠ Session
- Attendance ≠ assessment pass ≠ Program completion ≠ onboarding completion ≠ Product adoption
- Certificate ≠ professional accreditation / licensure
- Invitation / calendar acceptance / meeting-link access alone ≠ attendance
- Phase 16 handoff + accepted commercial / entitlement scope are authoritative for Product/role Training scope
- Exact retries must not duplicate Requests, Programs, curriculum materialisation, Sessions, attendance, attempts, or certificates
- Assessment timing and attempt limits are server-authoritative; final results immutable (regrade records only)
- Completion is deterministic against a versioned policy; UNKNOWN ≠ COMPLETED
- Phase 17 receives typed Training-domain outcomes only; onboarding UI cannot fabricate Training completion; Training complete ≠ auto onboarding complete
- No Production Customer data in shared practice environments; no credentials in materials/notes/exports
- No AI-generated course content, questions, attendance, results, or certificates
- Reliability / metric gate fail → never fabricated zero
- Virtual provider = `VIRTUAL_PROVIDER_NOT_CONFIGURED` until configured
- System `/insightbooks/chart-of-accounts` stays removed; no Tenant GL / Subscription / entitlement mutations from Training
- Expected phase exit (Wave 4): **READY_FOR_PHASE_19_WITH_BLOCKERS**

## Classification legend

| Class | Meaning |
|-------|---------|
| CORRECT_AND_REUSABLE | Keep as boundary / input; do not redefine |
| REUSE_WITH_RECONCILIATION | Reuse only with explicit mapping / honesty |
| EXTEND | Reuse and extend under Training domain |
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
| NON_IDEMPOTENT | Exists but lacks Training-grade idempotency |
| UNVERSIONED | Missing version / checksum / immutability |
| UNRECONCILED | Missing recon to parent truth |
| ATTENDANCE_TRUTH_RISK | Risk of false attendance from invite/RSVP/link |
| ASSESSMENT_TRUTH_RISK | Risk of false pass / leaked answers / client timer |
| COMPLETION_TRUTH_RISK | Risk of false Program/Participant completion |
| CERTIFICATE_TRUTH_RISK | Risk of cert without completion / forged verify |
| TRAINING_TRUTH_RISK | Risk of readiness ≠ training complete |
| CUSTOMER_ACTION_TRUTH_RISK | Risk of fabricating Customer action |
| CROSS_TENANT_RISK | Scope / isolation gap |
| CROSS_BUSINESS_RISK | Business isolation gap |
| CROSS_BRANCH_RISK | Branch isolation gap |
| CUSTOMER_PORTFOLIO_RISK | CS portfolio scope gap |
| CONTACT_PRIVACY_RISK | Contact PII exposure risk |
| FILE_SECURITY_RISK | Materials/env file security gap |
| PERFORMANCE_RISK | Scale / N+1 / cache risk |
| REMOVE_AFTER_MIGRATION | Legacy after Program link |
| BLOCKED | Cannot proceed until dependency cleared |
| NOT_APPLICABLE | Out of Training plane |
| NOT_FOUND | Absent in codebase / schema |
| NOT_AVAILABLE | Explicitly deferred with typed contract |
| FORBIDDEN | Must not be used / invented for this phase |

## Pack index

- Scope / validation: `PHASE_18_SCOPE.md`, `PHASE_INPUT_VALIDATION.md`
- CURRENT_* domain audits + `TRAINING_*` DQ/privacy/security/performance/recon
- Matrices: `TRAINING_*_MATRIX.md`
- Gaps / plan / readiness: `PHASE_18_GAP_REGISTER.md`, `IMPLEMENTATION_PLAN.md`, `FINAL_READINESS_DECISION.md`
- Full phase exit report deferred to Wave 4 (`FINAL_PHASE_18_REPORT.md` / `PHASE_19_INPUTS.md`)
