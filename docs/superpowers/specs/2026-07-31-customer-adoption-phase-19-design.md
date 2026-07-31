# Customer Adoption Phase 19 — Design

**Status:** Approved (user review 2026-07-31)  
**Date:** 2026-07-31  
**Surface:** `/insightbooks/customer-success/adoption` (+ overview, my-work, team, portfolio, attention, requests, plans, milestones, outcomes, champions, dormancy, interventions, expansion, reports, settings; thin extensions on onboarding / training / CS customer deep-links)  
**Architecture:** Approach 1 — dual-entity `CustomerAdoptionRequest` + `CustomerAdoptionPlan` spine; reconcile Phase 8 Success Plans / Playbooks / Interventions; consume Phase 18 Training outcomes + Phase 9 product-analytics evidence (read-only)  
**Upstream exit:** Phase 18 `READY_FOR_PHASE_19_WITH_BLOCKERS` (`docs/admin-intelligence-crm/phase-18/PHASE_19_INPUTS.md`)

---

## 1. Purpose

Deliver one authoritative, evidence-based Customer Adoption plane that consumes honest Training completion and onboarding handover attachments, manages Adoption Requests through Plans with role-based milestones, value outcomes, champion development, dormancy recovery, Phase 8 interventions, and expansion/renewal handoffs — without inventing product usage, fabricating milestone MET/Plan COMPLETED, duplicating Phase 8/9 engines, or executing renewals/billing/entitlements.

---

## 2. Locked decisions

| Topic | Decision |
|-------|----------|
| Domain vs Phase 8 | **A** — new Request/Plan spine; link Phase 8 Success Plan / Playbook / Intervention (do not rebuild) |
| Entry | **C** — hybrid: auto Request from Phase 18 Program `COMPLETED` + optional manual; onboarding handover may attach (never invents Training COMPLETED) |
| Analytics / dormancy | **A** — Phase 9 first-value / adoption / signals read-only evidence; thin dormancy recovery that launches Phase 8 interventions |
| Ops depth | **A** — milestones, value outcomes, champions, dormancy recovery, expansion/renewal handoff records (handoff ≠ execute) |
| Architecture | **Approach 1** — dual-entity Request + Plan |
| Sequencing | **Approach B** waves + SDD |
| Exit | Expect **`READY_FOR_PHASE_20_WITH_BLOCKERS`** when Phase 18 carry blockers + thin UI / advanced ML / portal self-serve remain explicit |
| Commits | Only when user asks; WORKING_TREE OK; SQL + model guards if Prisma EPERM |

---

## 3. Hard rules

- Adoption Handoff/attach ≠ Adoption Request ≠ Adoption Plan ≠ Milestone ≠ Intervention ≠ Expansion execute.
- Training Program `COMPLETED_WITH_GAPS` / partial participant completion ≠ auto Adoption Request; only true Program aggregate `COMPLETED` auto-creates.
- Onboarding Project COMPLETED / handover accepted ≠ Adoption Plan COMPLETED; attach only.
- Phase 8 historical Success Plan / checklist COMPLETED ≠ Adoption Plan COMPLETED without linked Plan evidence.
- Phase 9 gate fail / missing instrumentation → evidence `UNAVAILABLE` / milestone `UNKNOWN` — never invent MET or KPI zeroes.
- Certificate / Training progress % ≠ product adoption; cert ≠ professional accreditation (Phase 18 carry).
- Expansion / renewal handoff ≠ mutate Subscription, Entitlement, Platform Invoice/Payment, or Tenant GL.
- Interventions execute only via Phase 8 APIs; Adoption stores link + outcome attestation.
- Exact retries must not duplicate Requests, Plans, milestone materialisation, dormancy cases, intervention links, or expansion handoffs.
- Plan COMPLETED requires policy-defined critical milestones MET (or audited WAIVED) + value review sign-off — not “any milestone done”.
- Dormancy recovery COMPLETED requires usage-return snapshot and/or attested outreach outcome — never auto-complete from signal absence.
- System `/insightbooks/chart-of-accounts` stays removed; no Tenant GL from Adoption.
- Reliability / metric gate fail → never fabricated zero.
- Virtual provider / training portal / rich LMS banks / payment / e-sign remain typed unavailable until configured (Phase 18 carry).

---

## 4. Domain architecture

```text
Phase 18 CustomerTrainingProgram (COMPLETED)
        + optional Phase 17 Onboarding Handover attach
        + optional Manual CS
        ↓
CustomerAdoptionRequest  (ADR-YYYY-######)
        ↓ accept + convert + planTemplateVersionId
CustomerAdoptionPlan     (ADP-YYYY-######)
        ├── Milestone instances (role-based, evidence modes)
        ├── Value / business outcome records (+ Phase 9 snapshots)
        ├── Champion assignments
        ├── Dormancy recovery cases → Phase 8 Intervention link
        ├── Playbook / Success Plan links (Phase 8 ids)
        ├── Expansion / renewal handoff records (HANDED_OFF / ACKNOWLEDGED)
        └── Reports / DQ / recon / lineage / exports
```

**Canonical services (illustrative):**
- `consumeTrainingCompletionForAdoption({ actorContext, programId, idempotencyKey })` → Request
- `attachOnboardingHandoverToAdoption({ actorContext, handoverId, requestId|planId, idempotencyKey })`
- `createManualAdoptionRequest` / `acceptAdoptionRequest` / `rejectAdoptionRequest`
- `createCustomerAdoptionPlan({ actorContext, adoptionRequestId, planTemplateVersionId, ownerAssignments, idempotencyKey })`
- `evaluateAdoptionMilestone` / `attestAdoptionMilestone` / `waiveAdoptionMilestone`
- `recordAdoptionValueOutcome` / `evaluateAdoptionPlanCompletion`
- `upsertAdoptionChampion` / `openDormancyRecoveryCase` / `linkPhase8Intervention`
- `createExpansionHandoff` / `acknowledgeExpansionHandoff`
- `getAdoptionOverviewCards` / `exportAdoptionReport` (answers/tokens stripped; portfolio fail-closed)

**Reuse:** Phase 18 Training completion/certificates/programs; Phase 17 handover/completion surfaces; Phase 8 plans/playbooks/interventions/authz; Phase 9 `productAnalytics` first-value/adoption/signals; Phase 11 Contacts; Phase 13 Tasks/Email where outreach tasks are needed.

**Do not duplicate:** Phase 8 case/intervention engine; Phase 9 event warehouse; Platform Customer/Tenant/Subscription/Entitlement; Training Program as a second LMS; Onboarding Project spine; renewals billing execute path.

**Phase 8 reconcile:** Success Plan / Playbook / Intervention gain optional `adoptionPlanId` (or Adoption stores foreign ids). Unresolved legacy → UNKNOWN — never invent Plan COMPLETED.

---

## 5. Request model

### Sources
`PHASE_18_TRAINING_COMPLETED`, `PHASE_17_ONBOARDING_HANDOVER`, `CUSTOMER_SUCCESS_MANUAL`, `SUPPORT_RECOMMENDATION`, `PRODUCT_SIGNAL`, `DORMANCY_RECOVERY`, `EXPANSION_SIGNAL`, `PLAN_UPGRADE`, `ADD_ON_ACTIVATION`, `LEGACY_MIGRATION`, `API`, `OTHER`.

### Pins
Request number `ADR-YYYY-######`, source + reference, Training Program id (when auto), onboarding Project/handover ids (when attach), Customer, Tenant, Subscription, target roles/modules, owners, validation/duplicate state, status, idempotency, audit.

### Statuses
`NEW`, `VALIDATING`, `INFORMATION_REQUIRED`, `DUPLICATE_REVIEW_REQUIRED`, `READY`, `ACCEPTED`, `REJECTED`, `CONVERTED_TO_PLAN`, `CUSTOMER_DEFERRED`, `CANCELLED`, `SUPERSEDED`, `ARCHIVED`.

One conversion to Plan (concurrency-safe). Exact Training COMPLETED retry → same Request. `COMPLETED_WITH_GAPS` must not create Request.

---

## 6. Plan model

### Pins
Plan number `ADP-YYYY-######`, request id, Customer/Tenant, templateVersionId (immutable once applied), owner CS agent, linked Phase 8 successPlanId (optional), status, health, valueReview state, idempotency, audit.

### Statuses
`DRAFT`, `ACTIVE`, `ON_TRACK`, `AT_RISK`, `VALUE_REVIEW`, `COMPLETED`, `CHURN_RISK`, `HANDED_TO_RENEWALS`, `CANCELLED`, `ARCHIVED`.

`UNKNOWN` is an evaluation/evidence state, never a silent READY/COMPLETED.

### Completion policy
`evaluateAdoptionPlanCompletion` requires:
1. All **critical** milestones `MET` or audited `WAIVED`
2. Value review sign-off recorded
3. No blocking DQ / unresolved Critical defects on Plan
4. Manage authz + portfolio access

Status transition to `COMPLETED` must call evaluation (or audited executive waiver) — pure FSM edge forbidden.

---

## 7. Milestones & value outcomes

### Milestone
- Role target (owner / admin / accountant / champion / other catalogue role)
- Evidence mode: `PRODUCT_ANALYTICS` | `TRAINING_CERT` | `CS_ATTESTATION` | `MIXED`
- Status: `NOT_STARTED` | `IN_PROGRESS` | `MET` | `MISSED` | `WAIVED` | `UNKNOWN`
- Due window; lineage to Phase 9 snapshot and/or Training cert and/or attestation record

### Evidence honesty
| Mode | MET requires |
|------|----------------|
| PRODUCT_ANALYTICS | Fresh Phase 9 snapshot meeting definition; gate fail → UNKNOWN/UNAVAILABLE |
| TRAINING_CERT | Phase 18 Program COMPLETED and/or valid non-revoked certificate |
| CS_ATTESTATION | manageCases actor + reason; critical waiver SoD |
| MIXED | Policy intersection (all required evidence present) |

### Value outcomes
Records such as time-to-first-value, feature activation set, repeat-value signal store measured snapshot + `sourceSystem` + observedAt. Missing analytics → status UNAVAILABLE, value null — never zero-as-success.

---

## 8. Champions, dormancy, interventions, expansion

### Champions
Per Plan/tenant contact: role, enablement status, last evidence ref. Tasks may open Phase 8 interventions/playbooks. No fabricated engagement scores.

### Dormancy recovery
Risk queue sourced from Phase 9 `VALUE_THEN_INACTIVE` / inactive-class signals (typed UNAVAILABLE if analytics missing). Case lifecycle: `OPEN` → `INTERVENTION_LINKED` → `MONITORING` → `RECOVERED` | `ESCALATED` | `CLOSED_UNRESOLVED`.  
`RECOVERED` requires usage-return snapshot and/or attested outreach outcome.

### Interventions
Store `interventionId` / playbook run id + outcome attestation. Do not re-implement Phase 8 engine.

### Expansion / renewal handoffs
Entity (e.g. `CustomerAdoptionExpansionHandoff`): signal package, evidence refs, target queue (`RENEWALS` | `SALES` | `CS_LEADERSHIP`), status `DRAFT` → `HANDED_OFF` → `ACKNOWLEDGED` | `REJECTED` | `EXPIRED`.  
Stops before Subscription/entitlement/billing mutation. Idempotent on exact retry.

---

## 9. UI, permissions, privacy

### Routes
Primary: `/insightbooks/customer-success/adoption` and children listed in header. Thin deep-links from onboarding, training, CS customer 360. Intelligence product-analytics pages remain the analytics home; Adoption embeds evidence cards, not a second warehouse UI.

### UI patterns
Server-paginated lists + mobile cards; Context Bar (freshness, recon, portfolio scope); Overview cards fail → `UNAVAILABLE` / `value: null`. EN + Chichewa (`ny`) hub keys.

### Permissions
Reuse `systemAdmin.customerSuccess.read` | `.manageCases` | `.manageRenewals` via `lib/admin/customerSuccess/authz.js` (+ adoption helpers). Portfolio fail-closed on list/search/export/DQ/metrics and writes-by-id (`loadAdoptionPlanForActor` pattern).

### SoD
- Plan template author ≠ approver (where required)
- Critical milestone waiver ≠ sole attestor
- Expansion handoff creator ≠ renewals executor acknowledgment (where policy requires)
- Auditor read-only

### Privacy
Contact PII projected least-privilege; exports strip secrets/tokens; no credentials in notes.

---

## 10. Waves (SDD)

| Wave | Deliverable |
|------|-------------|
| 0 | Forensic pack + CONDITIONAL GO — Phase 18 inputs, Phase 8/9 reconcile, CURRENT/ADOPTION audits |
| 1 | Request/Plan spine + Training COMPLETED consume + manual + onboarding attach + status policy |
| 2 | Milestones / value outcomes + Phase 9 evidence snapshots + Plan completion evaluation |
| 3 | Champions / dormancy recovery / Phase 8 intervention links / expansion handoffs |
| 4 | UI hubs / metrics / DQ / recon / lineage / exports / search / Phase 20 pack |

**Domain path:** `lib/admin/customerSuccess/adoption/**`  
**Tests:** `test/systemAdmin.cs.adoptionWave{0..4}.test.js` (Wave 0 docs-only as prior phases)  
**SQL fallback:** `scripts/sql/cs-adoption-phase19-wave{1..4}.sql` if Prisma EPERM  

**Execution:** Subagent-Driven (fresh implementer + review per task; final whole-branch review). WORKING_TREE unless user requests commits.

---

## 11. Reporting, reconciliation, lineage

- Reliability gate: permission/model/query fail → `UNAVAILABLE`, `value: null`, never false zero
- DQ / recon: portfolio-scoped; thin stubs must not invent `lineageIntact: true` / `blockingDq: false` as success — use null + UNAVAILABLE until real checks exist
- Lineage: Request ← Training Program / Handover / Manual; Plan ← Request + template version; Milestone ← evidence snapshots; Handoff ← Plan + signal package
- Search/export fail-closed for CS portfolio actors; Super Admin fleet-wide by design

---

## 12. Exit criteria

**Target:** `READY_FOR_PHASE_20_WITH_BLOCKERS`

Must be true:
- Canonical Request/Plan domain live under `lib/admin/customerSuccess/adoption/**`
- Auto Request only from Program aggregate COMPLETED; WITH_GAPS/partial never auto-create
- Plan COMPLETED gated by evaluation policy + manage/portfolio authz
- Phase 9 evidence honesty (no invented MET/zeroes)
- Phase 8 interventions linked, not duplicated
- Expansion handoff ≠ execute billing/entitlements
- List/search/export/DQ/metrics/writes fail-closed portfolio scope
- Vitest Waves 1–4 green
- Phase 20 input pack documents carry blockers honestly

**Explicit blockers (carry / optional):**
- Phase 18: virtual provider, session recording, rich LMS banks, training portal, payment/e-sign
- Phase 19 optional: advanced ML churn scoring, rich customer self-serve adoption portal, deep renewals execute integration beyond handoff ACK

---

## 13. Out of scope

- Replacing Phase 8 CS case/playbook/intervention engines
- Replacing Phase 9 product-analytics warehouse
- Executing subscription renewals, proration, invoicing, or entitlement grants from Adoption
- Full customer-facing adoption LMS/portal (typed unavailable if referenced)
- AI-generated milestones, fake usage, or fabricated champion scores
- Tenant GL / System CoA admin surface

---

## 14. Downstream (Phase 20 seeds)

Phase 20 may deepen renewals execute-after-ACK, expansion quoting, advanced health scoring, and portal self-serve — consuming Adoption Plans / handoffs / value outcomes without inventing completion from empty foundations.
