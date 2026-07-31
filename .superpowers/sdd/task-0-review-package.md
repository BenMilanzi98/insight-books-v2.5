# Task 0 Review Package (WORKING_TREE docs — no commits)
Base: 7d9709a897bc0d4609ce8a6725aad7d9cf1cb835 (unchanged HEAD)
Head: WORKING_TREE
File count: 54

## File list
- CURRENT_ONBOARDING_ACCOUNTING_SETUP_AUDIT.md (980 bytes)
- CURRENT_ONBOARDING_ARCHITECTURE_AUDIT.md (2021 bytes)
- CURRENT_ONBOARDING_BUSINESS_BRANCH_SETUP_AUDIT.md (840 bytes)
- CURRENT_ONBOARDING_CHECKLIST_AUDIT.md (735 bytes)
- CURRENT_ONBOARDING_COMPLETION_AUDIT.md (977 bytes)
- CURRENT_ONBOARDING_CUSTOMER_RESPONSIBILITY_AUDIT.md (795 bytes)
- CURRENT_ONBOARDING_DATA_MIGRATION_COORDINATION_AUDIT.md (984 bytes)
- CURRENT_ONBOARDING_EXPORT_AUDIT.md (833 bytes)
- CURRENT_ONBOARDING_GO_LIVE_AUDIT.md (725 bytes)
- CURRENT_ONBOARDING_HANDOVER_AUDIT.md (755 bytes)
- CURRENT_ONBOARDING_KICKOFF_AUDIT.md (1036 bytes)
- CURRENT_ONBOARDING_MILESTONE_AUDIT.md (670 bytes)
- CURRENT_ONBOARDING_MRA_EIS_AUDIT.md (1076 bytes)
- CURRENT_ONBOARDING_PRODUCT_CONFIGURATION_AUDIT.md (741 bytes)
- CURRENT_ONBOARDING_PROJECT_AUDIT.md (1158 bytes)
- CURRENT_ONBOARDING_REPORT_AUDIT.md (849 bytes)
- CURRENT_ONBOARDING_REQUEST_AUDIT.md (1324 bytes)
- CURRENT_ONBOARDING_STABILISATION_AUDIT.md (617 bytes)
- CURRENT_ONBOARDING_STAKEHOLDER_AUDIT.md (868 bytes)
- CURRENT_ONBOARDING_TASK_AUDIT.md (931 bytes)
- CURRENT_ONBOARDING_TEMPLATE_AUDIT.md (920 bytes)
- CURRENT_ONBOARDING_TENANT_READINESS_AUDIT.md (935 bytes)
- CURRENT_ONBOARDING_TESTING_AUDIT.md (636 bytes)
- CURRENT_ONBOARDING_TRAINING_COORDINATION_AUDIT.md (961 bytes)
- CURRENT_ONBOARDING_USER_ACCESS_AUDIT.md (737 bytes)
- CURRENT_ONBOARDING_WORKSTREAM_AUDIT.md (730 bytes)
- FINAL_READINESS_DECISION.md (3313 bytes)
- IMPLEMENTATION_PLAN.md (1773 bytes)
- ONBOARDING_COMPLETION_MATRIX.md (924 bytes)
- ONBOARDING_DATA_QUALITY_AUDIT.md (1420 bytes)
- ONBOARDING_DOMAIN_MATRIX.md (1243 bytes)
- ONBOARDING_GO_LIVE_MATRIX.md (1056 bytes)
- ONBOARDING_MIGRATION_MATRIX.md (868 bytes)
- ONBOARDING_MILESTONE_MATRIX.md (648 bytes)
- ONBOARDING_MRA_MATRIX.md (753 bytes)
- ONBOARDING_PERFORMANCE_AUDIT.md (1097 bytes)
- ONBOARDING_PRIVACY_AUDIT.md (1151 bytes)
- ONBOARDING_RECONCILIATION_AUDIT.md (1365 bytes)
- ONBOARDING_RELIABILITY_MATRIX.md (870 bytes)
- ONBOARDING_RESPONSIBILITY_MATRIX.md (568 bytes)
- ONBOARDING_SECURITY_AUDIT.md (1359 bytes)
- ONBOARDING_SECURITY_MATRIX.md (1136 bytes)
- ONBOARDING_SOURCE_MATRIX.md (1146 bytes)
- ONBOARDING_TASK_MATRIX.md (739 bytes)
- ONBOARDING_TEMPLATE_MATRIX.md (685 bytes)
- ONBOARDING_TENANT_READINESS_MATRIX.md (1051 bytes)
- ONBOARDING_TESTING_MATRIX.md (506 bytes)
- ONBOARDING_TRAINING_MATRIX.md (620 bytes)
- ONBOARDING_TYPE_MATRIX.md (993 bytes)
- ONBOARDING_WORKSTREAM_MATRIX.md (1142 bytes)
- PHASE_17_GAP_REGISTER.md (4883 bytes)
- PHASE_17_SCOPE.md (3305 bytes)
- PHASE_INPUT_VALIDATION.md (5980 bytes)
- README.md (5400 bytes)

---
## FILE: README.md
```markdown
# Phase 17 â€” Customer Onboarding

**Surface:** `/insightbooks/customer-success/onboarding` (+ requests, templates, queues, reports, settings; thin deep-links from conversion / CS customer)

**Architecture:** Approach 1 â€” dual-entity `CustomerOnboardingRequest` (`ONR-`) + `CustomerOnboardingProject` (`ONB-`) under `lib/admin/customerSuccess/onboarding/*`; reconcile Phase 8 `CsOnboardingRecord`; consume Phase 16 domain handoffs

**Design:** `docs/superpowers/specs/2026-07-31-customer-onboarding-phase-17-design.md`

**Plan:** `docs/superpowers/plans/2026-07-31-customer-onboarding-phase-17.md`

**Handoff in:** `docs/admin-intelligence-crm/phase-16/PHASE_17_INPUTS.md`

**Phase 16 exit:** `READY_FOR_PHASE_17_WITH_BLOCKERS`

**Wave 0 decision:** **CONDITIONAL GO** for Wave 1 â€” see `FINAL_READINESS_DECISION.md`

**Execution mode:** Subagent-Driven (chosen). Wave 1 may proceed after controller review of this pack.

## Wave status

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Forensic audits + matrices + readiness | Complete (2026-07-31) |
| 1 | Request/Project spine + numbering + state machines + handoff consume + idempotency | Not started |
| 2 | Templates/materialisation + kick-off (Phase 13) + stakeholders + tasks/evidence + scope/CR | Not started |
| 3 | Readiness coordination + migration/MRA/training coord + testing + go-live â†’ stabilisation â†’ handover â†’ completion certificate | Not started |
| 4 | UI hubs + metrics/reliability + DQ/recon + reports/exports + Phase 8 migrate + Phase 18 pack | Not started |

## Hard rules

- Onboarding Handoff â‰  Onboarding Request â‰  Onboarding Project
- Onboarding â‰  Training â‰  Data Migration â‰  Support â‰  Customer Health
- Go-live â‰  Onboarding completion; Progress % â‰  completion
- Phase 16 handoff + accepted commercial snapshot are authoritative for Product/Plan/add-ons/quantities
- Scope mismatch â†’ Change Request + commercial/subscription handoff â€” never silent entitlement escalation
- Customer Tasks require evidence (or authorised verified waiver); no fabricated Customer/Task/Milestone/migration/training/MRA/go-live/completion
- RSVP â‰  attendance; kick-off Meeting via Phase 13 or fail closed (`MEETING_SERVICE_UNAVAILABLE`)
- No direct OB/stock/Journal/AR/AP/tax posts; no MRA credentials fabrication; no unauthorised fiscal submit
- Training readiness â‰  Training completion (Phase 18 only); Migration upload alone â‰  complete; MRA/Training `UNKNOWN` â‰  READY
- Gate fail â†’ never false zero; System CoA admin stays removed; Tenant CoA remains functional
- Customer portal = `CUSTOMER_PORTAL_NOT_CONFIGURED`
- Exact retry â†’ existing Request/Project/materialisation/certificate; conflicting idempotency â†’ fail visibly
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
| DUPLICATED | Parallel truth exists â€” resolve |
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
| MIGRATION_TRUTH_RISK | Risk of upload/import â‰  migration complete |
| TRAINING_TRUTH_RISK | Risk of readiness â‰  training complete |
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

```
---
## FILE: PHASE_INPUT_VALIDATION.md
```markdown
# Phase 17 Input Validation

**Validated:** 2026-07-31  
**Upstream exit:** `READY_FOR_PHASE_17_WITH_BLOCKERS` (Phase 16 `FINAL_READINESS_DECISION.md` / `FINAL_PHASE_16_REPORT.md`)

## Sources checked

| Source | Path | Result |
|--------|------|--------|
| Phase 17 inputs | `docs/admin-intelligence-crm/phase-16/PHASE_17_INPUTS.md` | PRESENT â€” handoffs, CS assign, certificates, honesty gates listed |
| Readiness checklist | `docs/admin-intelligence-crm/phase-16/PHASE_17_READINESS_CHECKLIST.md` | PRESENT â€” must-be-true conversion plane checked; execution listed as carry |
| Final Phase 16 report | `docs/admin-intelligence-crm/phase-16/FINAL_PHASE_16_REPORT.md` | PRESENT â€” exit `READY_FOR_PHASE_17_WITH_BLOCKERS` |
| Onboarding handoff audit | `docs/admin-intelligence-crm/phase-16/CURRENT_ONBOARDING_HANDOFF_AUDIT.md` | PRESENT â€” handoff â‰  execute |
| Phase 8 onboarding audit | `docs/admin-intelligence-crm/phase-08/CURRENT_ONBOARDING_AUDIT.md` | PRESENT â€” NOT_INSTRUMENTED foundations |
| Design | `docs/superpowers/specs/2026-07-31-customer-onboarding-phase-17-design.md` | APPROVED 2026-07-31 â€” Approach 1 + Approach B |
| Plan | `docs/superpowers/plans/2026-07-31-customer-onboarding-phase-17.md` | PRESENT â€” Task 0 = this pack |

## Phase 16 must-be-true (consumed honestly)

| Gate | Evidence class |
|------|----------------|
| CrmConversionRequest / CrmConversion spine | CORRECT_AND_REUSABLE â€” `lib/admin/crm/conversions/*` |
| Customer / Tenant / Subscription pins on conversion | CORRECT_AND_REUSABLE â€” provision + subscription modules |
| CS assignment (ownership only) | CORRECT_AND_REUSABLE â€” `customerSuccess.js` `assignCustomerSuccessOwner`; `healthScore: null` |
| ONBOARDING handoff idempotent; `executionStatus` NOT_STARTED | CORRECT_AND_REUSABLE â€” `onboardingHandoff.js` + `handoffShared.js`; forces `onboardingCompleted: false` |
| TRAINING handoff distinct | CORRECT_AND_REUSABLE â€” `trainingHandoff.js`; `trainingCompleted: false` |
| MIGRATION handoff distinct | CORRECT_AND_REUSABLE â€” `migrationHandoff.js`; `productionImportExecuted: false` |
| MRA_EIS handoff distinct | CORRECT_AND_REUSABLE â€” `mraEisHandoff.js`; `fiscalSubmitted/credentialsStored: false` |
| Handoff â‰  execute | CORRECT_AND_REUSABLE â€” `serializeDomainHandoff` sets `recordOnly: true`, `executesDomainWork: false` |
| Completion certificate â‰  onboarding complete | CORRECT_AND_REUSABLE â€” `completion.js` `finalizeConversion` |
| Conversion reports honesty gate | CORRECT_AND_REUSABLE â€” `reliabilityGate.js` / `reports.js` |
| No Tenant GL from conversion | CORRECT_AND_REUSABLE â€” `accountingBoundary.js` |
| Payment initiation â‰  PAID; Closed Won â‰  ACTIVE | CORRECT_AND_REUSABLE boundary â€” do not assume PAID/ACTIVE |

## Phase 17 reuse plane (pre-Wave-1)

| Asset | Path | Class for Onboarding |
|-------|------|----------------------|
| Phase 16 ONBOARDING handoff | `lib/admin/crm/conversions/onboardingHandoff.js` | CORRECT_AND_REUSABLE â€” seed Request; never invent complete |
| Domain handoff shared | `lib/admin/crm/conversions/handoffShared.js` | CORRECT_AND_REUSABLE â€” types ONBOARDING/TRAINING/MIGRATION/MRA_EIS |
| `CrmConversionDomainHandoff` model | `prisma/schema.prisma` + `scripts/sql/crm-conversion-phase16-wave4.sql` | CORRECT_AND_REUSABLE |
| Phase 8 CsOnboardingRecord | `prisma` model + `foundations.js` | REUSE_WITH_RECONCILIATION â€” thin checklist; empty â†’ NOT_INSTRUMENTED; link in Wave 4 |
| CS foundations UI/API | `app/insightbooks/customer-success/onboarding/page.js`, `app/api/admin/customer-success/foundations/route.js` | EXTEND / DISCONNECTED â€” foundations view only; not Request/Project spine |
| CS expansion handoffs | `lib/admin/customerSuccess/handoffs.js` | WRONG_DOMAIN for Closed-Won onboarding â€” record-only expansion â‰  ONBOARDING handoff |
| CS tasks | `lib/admin/customerSuccess/tasks.js` | WRONG_DOMAIN â€” case/playbook tasks â‰  onboarding Customer Tasks |
| Phase 13 Meetings | `lib/admin/crm/meetings/*` | CORRECT_AND_REUSABLE â€” kick-off; RSVP â‰  attendance |
| Tenant / Business / Branch provision | `tenantProvision.js`, `businessBranch.js` | CORRECT_AND_REUSABLE for readiness evaluation inputs |
| Invitations (hash-only) | `invitations.js` | CORRECT_AND_REUSABLE for user-access readiness |
| Accounting boundary pattern | `accountingBoundary.js` | REUSE_WITH_RECONCILIATION â€” mirror assert in onboarding modules |
| MRA EIS tenant domain | `lib/mraEis/**` | WRONG_DOMAIN for onboarding execution â€” coordinate via handoff + readiness checklist only |
| CS export | `lib/admin/customerSuccess/export.js` | EXTEND pattern â€” cases/tasks/plans/handoffs only; no onboarding Project export yet |
| `resolveCrmScope` | `lib/admin/crm/authz.js` | CROSS_TENANT_RISK â€” stub `mode: 'all'` |
| `CustomerOnboardingRequest` / Project | â€” | NOT_FOUND |
| `lib/admin/customerSuccess/onboarding/**` | â€” | NOT_FOUND |
| `app/api/admin/customer-success/onboarding*/**` | â€” | NOT_FOUND |
| Onboarding templates / materialisation | â€” | NOT_FOUND |
| Onboarding go-live / completion certificate | â€” | NOT_FOUND |

## Identity / handoff blockers?

**None** that block Wave 1 Request/Project spine + handoff consume + accept/convert + idempotency. Phase 16 ONBOARDING handoff exists, is distinct from TRAINING/MIGRATION/MRA_EIS, pins conversion/tenant in payload, and forces `executionStatus: NOT_STARTED` / `onboardingCompleted: false`. Customer/Tenant/Subscription pins come from conversion plane. Full execution domains remain Wave 2â€“3 / Phase 18 typed gaps.

## Validation verdict

**PASS** â€” Phase 16 exit is honest (`READY_FOR_PHASE_17_WITH_BLOCKERS`); design/plan locked; reuse plane identified (handoffs + Meetings + Phase 8 foundations CORRECT_AND_REUSABLE / REUSE_WITH_RECONCILIATION; Request/Project spine NOT_FOUND greenfield). Proceed to Wave 0 readiness decision (**CONDITIONAL GO**).

```
---
## FILE: FINAL_READINESS_DECISION.md
```markdown
# Final Readiness Decision â€” Wave 0 Interim (Phase 17)

**Decision:** **CONDITIONAL GO**

**Date:** 2026-07-31  
**Scope of this decision:** Wave 0 forensic pack complete â†’ Wave 1 application code may start after controller review  
**Not this document:** Full phase exit (`READY_FOR_PHASE_18_WITH_BLOCKERS`) â€” Wave 4 `FINAL_PHASE_17_REPORT.md`

## Rationale

1. **Phase 16 exit validated** â€” `READY_FOR_PHASE_17_WITH_BLOCKERS` confirmed via `PHASE_17_INPUTS.md`, `PHASE_17_READINESS_CHECKLIST.md`, `FINAL_READINESS_DECISION.md` (Phase 16). Input validation verdict: **PASS**.
2. **Handoff â‰  execute holds** â€” `onboardingHandoff.js` / `handoffShared.js` force `executionStatus: NOT_STARTED`, `onboardingCompleted: false`, `recordOnly: true`. TRAINING / MIGRATION / MRA_EIS handoffs are distinct typed rows.
3. **Pins available** â€” Customer/Tenant/Subscription truth exists on conversion plane (`tenantProvision`, `subscription`, `customerSuccess` assignment); handoff payload carries `conversionId` / `tenantId`.
4. **Greenfield expected, not blocking** â€” Request/Project spine, templates, kick-off binding, readiness, go-live, onboarding certificate are **NOT_FOUND** by design for Wave 1â€“3. Phase 8 `CsOnboardingRecord` is thin FOUNDATION (`NOT_INSTRUMENTED` when empty) â€” REUSE_WITH_RECONCILIATION in Wave 4, not a second domain.
5. **Reusable building blocks present** â€” Phase 13 Meetings (RSVP â‰  attendance), conversion accounting boundary, hash-only invitations, reliability-gate patterns.
6. **Carry blockers explicit** â€” portal NOT_CONFIGURED; Training/migration engines NOT_AVAILABLE; payment/e-sign NOT_CONFIGURED; `resolveCrmScope` CROSS_TENANT_RISK; Prisma EPERM CARRY â€” none block Wave 1 spine.

## Conditions for Wave 1

1. Implement under `lib/admin/customerSuccess/onboarding/*` only â€” do not treat CS foundations UI, expansion handoffs, or CsTask as the spine.
2. Consume Phase 16 ONBOARDING handoff idempotently; never fabricate onboarding complete; do not consume wrong handoff types as ONBOARDING Requests.
3. Require Customer/Tenant/Subscription pins on Request; seed ACTIVE STANDARD `templateVersionId` for Project pin.
4. Exact retry returns same Request/Project; conflicting idempotency fails visibly; one Request â†’ at most one Project.
5. No Tenant GL / OB / journals; no MRA credentials/fiscal; no Training COMPLETED; WORKING_TREE OK; commits only when user asks.
6. Execution mode: **Subagent-Driven** â€” proceed Wave 1 after controller review; SDD review gate before Wave 2.

## Wave 0 pack completion

- [x] Phase input validation PASS
- [x] CURRENT_* onboarding domain audits (architecture through export)
- [x] ONBOARDING_* DQ / recon / privacy / security / performance
- [x] Matrices (source, domain, type, template, workstream, milestone, task, responsibility, tenant readiness, migration, MRA, training, testing, go-live, completion, reliability, security)
- [x] `PHASE_17_GAP_REGISTER.md` + `IMPLEMENTATION_PLAN.md`
- [x] Wave 0 interim readiness decision recorded (**CONDITIONAL GO**)

**Next:** Wave 1 Request/Project spine + handoff consume (Task 1).  

**Stop:** No Wave 1 code in this Task 0 deliverable. Do not invent COMPLETED/READY from handoffs, foundations checklists, or conversion certificates.

```
---
## FILE: PHASE_17_GAP_REGISTER.md
```markdown
# Phase 17 Gap Register

**Audited:** 2026-07-31  
**Inputs:** Phase 16 `PHASE_17_INPUTS.md`, Wave 0 audits, design/plan

| ID | Gap | Severity | Wave | Notes |
|----|-----|----------|------|-------|
| G17-01 | No CustomerOnboardingRequest / ONR numbering | BLOCKER | 1 | Greenfield under `lib/admin/customerSuccess/onboarding/*` |
| G17-02 | No consumeOnboardingHandoff from Phase 16 ONBOARDING | BLOCKER | 1 | CORRECT_AND_REUSABLE emit in `onboardingHandoff.js` |
| G17-03 | No accept/reject/validate Request + status history | BLOCKER | 1 | Server-authorised transitions |
| G17-04 | No CustomerOnboardingProject / ONB numbering | BLOCKER | 1 | One Request â†’ one Project |
| G17-05 | No createOnboardingProject + idempotency/conflict fail | BLOCKER | 1 | Exact retry |
| G17-06 | No seeded ACTIVE STANDARD templateVersion for Project pin | BLOCKER | 1 | Prefer pin always; full templates Wave 2 |
| G17-07 | No Request/Project status machines (invalid transition reject) | BLOCKER | 1 | No IN_PROGRESSâ†’COMPLETED skip |
| G17-08 | Permissions skeleton `onboarding*` | HIGH | 1 | Today only `customerSuccess.read` on foundations route |
| G17-09 | Thin API/UI stubs for requests/projects | HIGH | 1 stubs â†’ 4 | Foundations page DISCONNECTED |
| G17-10 | Full Template/Version/approval/applicability | BLOCKER | 2 | UNVERSIONED today |
| G17-11 | materialiseOnboardingTemplate once | BLOCKER | 2 | Workstreams/Milestones/Tasks/Checklists |
| G17-12 | Kick-off â†” Phase 13 Meeting; RSVPâ‰ attendance; fail closed | BLOCKER | 2 | `lib/admin/crm/meetings/*` CORRECT_AND_REUSABLE |
| G17-13 | Stakeholders + Contact verification | HIGH | 2 | CONTACT_PRIVACY_RISK |
| G17-14 | Requirements/scope + Change Request on mismatch | BLOCKER | 2 | Never silent entitlement escalate |
| G17-15 | Customer Task evidence attestation + review SoD | BLOCKER | 2 | CUSTOMER_ACTION_TRUTH_RISK / TASK_COMPLETION_TRUTH_RISK |
| G17-16 | Task dependencies + cycle detection | HIGH | 2 | â€” |
| G17-17 | Responsibilities CUSTOMER/INSIGHTBOOKS/SHARED | HIGH | 2 | â€” |
| G17-18 | Tenant/Business/Branch/User/Config readiness evaluate | BLOCKER | 3 | UNKNOWNâ‰ READY; CROSS_* risks |
| G17-19 | Accounting readiness boundary assert (no journals/OB) | HIGH | 3 | Reuse `accountingBoundary.js` pattern |
| G17-20 | Migration coordination + recon gate + private files | BLOCKER | 3 | MIGRATION_TRUTH_RISK / FILE_SECURITY_RISK; engine NOT_AVAILABLE |
| G17-21 | MRA readiness coordination (no fiscal/credentials) | HIGH | 3 | CORRECT_AND_REUSABLE handoff; fiscal WRONG_DOMAIN |
| G17-22 | Training coordination (no COMPLETED without Phase 18) | HIGH | 3 | TRAINING_TRUTH_RISK |
| G17-23 | Testing/defects + Critical blocks go-live | HIGH | 3 | â€” |
| G17-24 | Go-live readiness/approval/execution â†’ STABILISATION | BLOCKER | 3 | GO_LIVE_TRUTH_RISK; activation WRONG_DOMAIN |
| G17-25 | Stabilisation exit + handover accept | BLOCKER | 3 | â€” |
| G17-26 | Onboarding completion certificate checksum + idempotent | BLOCKER | 3 | â‰  conversion certificate |
| G17-27 | Health/progress server calcs (no ML; progressâ‰ complete) | HIGH | 3 | â€” |
| G17-28 | UI hubs Overview/My Work/queues/detail tabs | MEDIUM | 1â€“4 | Thin early OK |
| G17-29 | Metrics + reliability gate (never false zero) | HIGH | 4 | Pattern from conversion |
| G17-30 | DQ / recon / lineage | HIGH | 4 | â€” |
| G17-31 | Reports + exports + search/cache (strip secrets) | HIGH | 4 | â€” |
| G17-32 | Phase 8 CsOnboardingRecord â†’ onboardingProjectId migrate | HIGH | 4 | REUSE_WITH_RECONCILIATION; UNKNOWN if unresolved |
| G17-33 | EN + NY i18n for onboarding surfaces | MEDIUM | 4 | â€” |
| G17-34 | Phase 18 input pack + FINAL_PHASE_17_REPORT | HIGH | 4 | Exit READY_FOR_PHASE_18_WITH_BLOCKERS |
| G17-35 | Customer portal evidence | CARRY | â€” | CUSTOMER_PORTAL_NOT_CONFIGURED |
| G17-36 | Full Training / migration engine / MRA fiscal | CARRY | â€” | NOT_AVAILABLE |
| G17-37 | Payment / e-sign providers | CARRY | â€” | Phase 16 NOT_CONFIGURED |
| G17-38 | resolveCrmScope stub mode:all | CARRY | Harden | CROSS_TENANT_RISK |
| G17-39 | Prisma EPERM Windows | CARRY | All | SQL + has*Model guards |
| G17-40 | AI plans/scores/approvals; fabricate complete/PAID | FORBIDDEN | â€” | Never |
| G17-41 | CS expansion / CsTask / Support as onboarding truth | PROCESS | All | WRONG_DOMAIN guards |
| G17-42 | Telephony / calendar sync / Lead ingest / Demo cloud | CARRY | Orthogonal | NOT_AVAILABLE / NOT_CONNECTED |

**No TBD blocking Wave 1 after CONDITIONAL GO** â€” Phase 16 ONBOARDING/TRAINING/MIGRATION/MRA handoffs are CORRECT_AND_REUSABLE and distinct; Customer/Tenant/Subscription pins available from conversion; Request/Project spine expected NOT_FOUND greenfield; Meetings CORRECT_AND_REUSABLE for Wave 2; Phase 8 foundations REUSE_WITH_RECONCILIATION for Wave 4.

```
---
## FILE: IMPLEMENTATION_PLAN.md
```markdown
# Phase 17 Implementation Plan (pointer)

**Authoritative plan:** [`docs/superpowers/plans/2026-07-31-customer-onboarding-phase-17.md`](../../superpowers/plans/2026-07-31-customer-onboarding-phase-17.md)

**Design:** [`docs/superpowers/specs/2026-07-31-customer-onboarding-phase-17-design.md`](../../superpowers/specs/2026-07-31-customer-onboarding-phase-17-design.md)

| Wave | Deliverable | Gap IDs |
|------|-------------|---------|
| 0 | This forensic pack (done 2026-07-31) | â€” |
| 1 | Request + Project spine + numbering + state machines + handoff consume + accept/reject/convert + idempotency + seeded STANDARD templateVersion + permissions skeleton + thin API/UI stubs | G17-01â€¦09, G17-39, G17-41 |
| 2 | Templates/versions/approval + materialisation + kick-off (Phase 13) + stakeholders + tasks/evidence/SoD + dependencies + responsibilities + requirements/scope/CR | G17-10â€¦17 |
| 3 | Readiness (tenant/biz/branch/user/config/accounting) + migration/MRA/training coordination + testing/defects + go-live â†’ stabilisation â†’ handover â†’ completion certificate + health/progress | G17-18â€¦27 |
| 4 | UI hubs + metrics/reliability + DQ/recon/lineage + reports/exports/search/cache + Phase 8 migrate + i18n + Phase 18 pack + FINAL reports | G17-28â€¦34 |

**Expected phase exit (Wave 4):** `READY_FOR_PHASE_18_WITH_BLOCKERS`  
(Portal, migration engine, Training execution, payment/e-sign providers, scope harden may remain deferred)

**Execution:** Subagent-Driven already chosen. Wave 1 may proceed after controller review of Wave 0 **CONDITIONAL GO**. **No application code in Wave 0.**  
**Skip:** `PHASE_18_INPUTS.md` / full `FINAL_PHASE_17_REPORT.md` until Wave 4 (this file's `FINAL_READINESS_DECISION.md` is Wave 0 interim only).

```
---
## FILE: CURRENT_ONBOARDING_ARCHITECTURE_AUDIT.md
```markdown
# Current Onboarding Architecture Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Dual-entity Request/Project spine | NOT_FOUND | No `CustomerOnboardingRequest` / `CustomerOnboardingProject` in `prisma/schema.prisma`; no `lib/admin/customerSuccess/onboarding/**` |
| Phase 16 ONBOARDING handoff emit | CORRECT_AND_REUSABLE | `lib/admin/crm/conversions/onboardingHandoff.js` â†’ `createDomainHandoff` with type `ONBOARDING` |
| Handoff â‰  execute | CORRECT_AND_REUSABLE | `handoffShared.js` forces `executionStatus: NOT_STARTED`, `executesDomainWork: false`, `recordOnly: true` |
| Distinct TRAINING/MIGRATION/MRA handoffs | CORRECT_AND_REUSABLE | `trainingHandoff.js`, `migrationHandoff.js`, `mraEisHandoff.js` â€” separate `handoffType` values |
| Phase 8 checklist foundation | REUSE_WITH_RECONCILIATION | `CsOnboardingRecord` + `foundations.js` `getFoundationStatus`; empty â†’ `NOT_INSTRUMENTED`; `progressPercent: null` |
| CS onboarding UI | DISCONNECTED / CLIENT_SIDE_ONLY foundations | `app/insightbooks/customer-success/onboarding/page.js` renders `CustomerSuccessFoundationsView kind="onboarding"` only |
| Foundations API | EXTEND | `app/api/admin/customer-success/foundations/route.js` |
| Route permission | EXTEND | `lib/admin/permissions.js` maps `/insightbooks/customer-success/onboarding` â†’ `customerSuccess.read` â€” no `onboarding*` SoD perms yet |
| CS expansion handoff | WRONG_DOMAIN | `lib/admin/customerSuccess/handoffs.js` â€” expansion record-only â‰  Closed-Won onboarding |
| Conversion completion â‰  onboarding complete | CORRECT_AND_REUSABLE | `lib/admin/crm/conversions/completion.js` |
| Fabricated onboarding complete | FORBIDDEN | Handoff payload forces `onboardingCompleted: false` |

**Implication:** Wave 1 greenfield Request/Project under `lib/admin/customerSuccess/onboarding/*`; consume Phase 16 handoff; reconcile Phase 8 later (Wave 4). Do not treat foundations UI or expansion handoffs as the onboarding spine.

```
---
## FILE: CURRENT_ONBOARDING_REQUEST_AUDIT.md
```markdown
# Current Onboarding Request Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| `CustomerOnboardingRequest` model | NOT_FOUND | No Prisma model; no SQL wave script for Phase 17 |
| `ONR-YYYY-######` numbering | NOT_FOUND | Numbering exists for conversion (`CVR-`) / meetings / support â€” not onboarding requests |
| `consumeOnboardingHandoff` | NOT_FOUND | Spec/plan name only; not implemented |
| Auto-create from Phase 16 handoff | NOT_FOUND | Emit path exists (`createOnboardingHandoff`); consume path absent |
| Accept / reject / convert Request | NOT_FOUND | â€” |
| Required pins (Customer/Tenant/Subscription) | REUSE_WITH_RECONCILIATION | Available on conversion + handoff `payloadJson` (`conversionId`, `tenantId`); Request must pin explicitly in Wave 1 |
| Request status machine | NOT_FOUND | Spec statuses `NEW`â€¦`ARCHIVED` not coded |
| Idempotency on handoff consume | EXTEND pattern | Handoff emit uses `idempotencyKey` unique on `CrmConversionDomainHandoff` â€” Request consume must mirror |
| Duplicate Request review | NOT_FOUND | â€” |
| API `onboarding-requests/**` | NOT_FOUND | No `app/api/admin/customer-success/onboarding-requests/**` |

**Implication:** Wave 1 BLOCKER greenfield â€” Request spine + consume + numbering + status history.

```
---
## FILE: ONBOARDING_SOURCE_MATRIX.md
```markdown
# Onboarding Source Matrix

| Source | Creates Request? | Class | Evidence / notes |
|--------|------------------|-------|------------------|
| `PHASE_16_ONBOARDING_HANDOFF` | Yes (auto, idempotent) | CORRECT_AND_REUSABLE | `createOnboardingHandoff` â†’ Wave 1 `consumeOnboardingHandoff` |
| `EXISTING_CUSTOMER_EXPANSION` | Manual/approved | REUSE_WITH_RECONCILIATION | CS expansion handoff WRONG_DOMAIN as auto seed; may MANUAL_APPROVED |
| `PLAN_UPGRADE` | Manual/approved | EXTEND | Requires commercial/subscription truth |
| `ADD_ON_ACTIVATION` | Manual/approved | EXTEND | â€” |
| `CUSTOMER_SUCCESS_REQUEST` | Manual/approved | EXTEND | CS case â‰  auto Project |
| `MANUAL_APPROVED` | Yes | EXTEND | Wave 1+ |
| `LEGACY_MIGRATION` | Controlled | REUSE_WITH_RECONCILIATION | Phase 8 rows â€” Wave 4 link/UNKNOWN |
| `API` | Future | NOT_AVAILABLE | â€” |
| `OTHER` | Gated | EXTEND | â€” |
| Conversion TRAINING/MIGRATION/MRA handoffs | No (distinct planes) | CORRECT_AND_REUSABLE | Do not create ONBOARDING Request from wrong handoff type |
| Conversion completion certificate | No | WRONG_DOMAIN | â‰  onboarding complete |

```

