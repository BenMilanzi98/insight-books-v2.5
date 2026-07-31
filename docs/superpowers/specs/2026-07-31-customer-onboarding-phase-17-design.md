# Customer Onboarding Phase 17 — Design

**Status:** Approved (user review 2026-07-31)  
**Date:** 2026-07-31  
**Surface:** `/insightbooks/customer-success/onboarding` (+ requests, templates, queues, reports, settings; thin extensions on conversion / CS customer / intelligence / provisioning deep-links)  
**Architecture:** Approach 1 — dual-entity `CustomerOnboardingRequest` + `CustomerOnboardingProject` spine; reconcile Phase 8 `CsOnboardingRecord`; consume Phase 16 domain handoffs  
**Upstream exit:** Phase 16 `READY_FOR_PHASE_17_WITH_BLOCKERS` (`docs/admin-intelligence-crm/phase-16/PHASE_17_INPUTS.md`)

---

## 1. Purpose

Deliver one authoritative, versioned, evidence-based Customer Onboarding plane that consumes Phase 16 onboarding handoffs and manages the Customer from request validation through kick-off, workstreams/milestones/tasks, tenant/access/configuration readiness, migration/MRA/training **coordination**, testing, go-live, stabilisation, handover, and completion — without fabricating Customer actions, duplicating domains, silently changing commercial scope, posting Tenant accounting, or executing full Training / migration engine / MRA fiscal flows.

---

## 2. Locked decisions

| Topic | Decision |
|-------|----------|
| Domain vs Phase 8 | **A** — new Request/Project spine; link/migrate `CsOnboardingRecord`; no second disconnected domain |
| Handoff → Request → Project | **A** — auto-create idempotent Request from Phase 16 ONBOARDING handoff; humans validate/accept; convert to Project with template |
| Customer evidence | **A** — admin-plane evidence + attestation; Customer portal typed `CUSTOMER_PORTAL_NOT_CONFIGURED` |
| Kick-off | **A** — hard-integrate Phase 13 Meeting / Calendar / RSVP / attendance; RSVP ≠ attendance; fail closed if Meeting service unavailable |
| Architecture | **Approach 1** — dual-entity Request + Project |
| Sequencing | **Approach B** waves + SDD stop gates |
| Exit | Expect **`READY_FOR_PHASE_18_WITH_BLOCKERS`** when optional portal / migration engine / Training execution / providers remain explicit |
| Commits | Only when user asks; WORKING_TREE OK; SQL + model guards if Prisma EPERM |

---

## 3. Hard rules

- Onboarding Handoff ≠ Onboarding Request ≠ Onboarding Project.
- Onboarding ≠ Training ≠ Data Migration ≠ Support ≠ Customer Health.
- Go-live ≠ Onboarding completion; Progress % ≠ completion.
- Phase 16 handoff + accepted commercial snapshot are authoritative for Product/Plan/add-ons/quantities.
- Scope mismatch → Change Request + commercial/subscription handoff — never silent entitlement escalation.
- Customer Tasks require evidence (or authorised verified waiver); internal actors do not fabricate Customer completion.
- Internal Tasks are not completable by Customer actors.
- Milestone / go-live / completion require source-backed evidence and approvals.
- Migration file upload alone ≠ migration complete; financial migration requires reconciliation.
- Training readiness ≠ Training completion; only Phase 18 Training domain may declare DELIVERED/COMPLETED/PASSED/CERTIFIED.
- MRA EIS `UNKNOWN` ≠ READY; no fabricated credentials; no unauthorised fiscal submission.
- No direct opening balance / opening stock / Journal / AR / AP / tax postings from onboarding.
- No AI-generated onboarding plans, Customer decisions, go-live approvals, or ML health scores.
- Reliability / metric gate fail → never fabricated zero (`UNAVAILABLE` / `value: null`).
- System `/insightbooks/chart-of-accounts` stays removed; Tenant CoA remains functional.
- Exact retries must not duplicate Requests, Projects, Workstreams, Milestones, Tasks, Checklists, Kick-off Meetings, or Completion certificates.

---

## 4. Domain architecture

```text
Phase 16 CrmConversionDomainHandoff (ONBOARDING, executionStatus NOT_STARTED)
        ↓ idempotent consume
CustomerOnboardingRequest  (ONR-YYYY-######)
        ↓ validate / accept
        ↓ convert + templateVersionId
CustomerOnboardingProject  (ONB-YYYY-######)
        ├── TemplateVersion (immutable once applied)
        ├── Workstreams → Milestones → Tasks / Checklists
        ├── Kickoff → Phase 13 CrmMeeting (RSVP ≠ attendance)
        ├── Stakeholders / Responsibilities / Requirements / Scope
        ├── Change Requests (commercial impact handoff)
        ├── Tenant / Business / Branch / User / Config readiness
        ├── Accounting setup coordination (boundary only)
        ├── Migration / MRA / Training coordination (typed refs)
        ├── Testing / Defects
        ├── GoLive → Stabilisation → Handover
        ├── Risks / Issues / Decisions / Documents / Communications
        └── CompletionCertificate (checksum)
```

**Canonical services (illustrative):**
- `consumeOnboardingHandoff({ actorContext, handoffId, idempotencyKey })` → Request
- `acceptOnboardingRequest` / `rejectOnboardingRequest`
- `createOnboardingProject({ actorContext, onboardingRequestId, onboardingTemplateVersionId, targetKickoffDate, targetGoLiveDate, ownerAssignments, idempotencyKey })`
- Server-side: progress, health, readiness evaluation, completion evaluation

**Reuse:** Phase 16 handoffs; Phase 8 CS foundations (reconcile); Phase 13 Meetings/Tasks/Calendar/comms; Phase 7 Customer 360; Phase 9 entitlements; Phase 10 Support handoff; existing Tenant/User/RBAC/provisioning services.

**Do not duplicate:** Platform Customer, Tenant, Business, Branch, Subscription, Entitlement, CRM Contact, Support Ticket, Training Session, Migration Job, Platform Invoice, MRA credential store, Tenant accounting truth.

**Phase 8 reconcile:** `CsOnboardingRecord` links to `onboardingProjectId` (or equivalent). New writes go to Project; foundations UI projects from Project when linked. Historical rows migrate or mark `UNKNOWN` where evidence missing — never invent COMPLETED.

---

## 5. Request model

### Sources
`PHASE_16_ONBOARDING_HANDOFF`, `EXISTING_CUSTOMER_EXPANSION`, `PLAN_UPGRADE`, `ADD_ON_ACTIVATION`, `CUSTOMER_SUCCESS_REQUEST`, `MANUAL_APPROVED`, `LEGACY_MIGRATION`, `API`, `OTHER`.

### Required pins
Request number, source + source reference, conversion (when applicable), handoff id, Customer, Tenant, Subscription, onboarding type, product/plan/add-on scope, businesses/branches/user scope, implementation/migration/MRA/training scope, target dates, owners, validation/duplicate state, status, idempotency identity, audit.

### Statuses
`NEW`, `VALIDATING`, `INFORMATION_REQUIRED`, `DUPLICATE_REVIEW_REQUIRED`, `READY`, `ACCEPTED`, `REJECTED`, `CONVERTED_TO_PROJECT`, `CUSTOMER_DEFERRED`, `CANCELLED`, `SUPERSEDED`, `ARCHIVED`.

Transitions are server-authorised, history-preserving, audited. **One** conversion to Project per Request (concurrency-safe).

### Numbering
`ONR-YYYY-######` — unique, immutable, server-generated, never recycled, not an authz mechanism.

---

## 6. Project, types, templates

### Project pins
Onboarding number `ONB-YYYY-######`, type, Request, Conversion, Customer, Tenant, Subscription, accepted commercial versions/snapshot, Plan/add-ons/entitlements, businesses/branches, owner set (CS / Implementation / Technical / Migration / MRA / Training / Customer project owner / executive sponsor), kick-off/go-live/stabilisation/completion dates, status, phase, progress, readiness, health, **templateVersionId**, risk/issue/sign-off/handover states, optimistic locking, audit.

### Types (catalogue)
`STANDARD`, `EXPRESS`, `ENTERPRISE`, `MULTI_BUSINESS`, `MULTI_BRANCH`, `MRA_EIS`, `DATA_MIGRATION`, `TRAINING_LED`, `CUSTOMER_EXPANSION`, `PLAN_UPGRADE`, `ADD_ON`, `PARTNER_LED`, `RESELLER_LED`, `CUSTOM_APPROVED` — each defines default duration, required owners/workstreams/milestones/tasks/checklists/sign-offs/dependencies, go-live/stabilisation/completion policies.

### Project statuses (abbrev.)
`DRAFT` → `REQUEST_VALIDATION` → `READY_FOR_KICKOFF` → `KICKOFF_SCHEDULING` → `KICKOFF_COMPLETED` → `PLANNING` → `IN_PROGRESS` → … coordination states … → `GO_LIVE_READINESS` → `READY_FOR_GO_LIVE` → `GO_LIVE_SCHEDULED` → `GO_LIVE_IN_PROGRESS` → `LIVE` → `STABILISATION` → `HANDOVER_PENDING` → `COMPLETION_PENDING` → `COMPLETED` / `COMPLETED_WITH_OPEN_ITEMS` (+ `PAUSED`, `BLOCKED`, `CUSTOMER_DEFERRED`, `CANCELLED`, `FAILED`, `ARCHIVED`).

Invalid transitions fail visibly. No direct `IN_PROGRESS` → `COMPLETED`.

### Phases
`REQUEST_AND_VALIDATION`, `KICKOFF`, `DISCOVERY_AND_SCOPE_CONFIRMATION`, `PLANNING`, `TENANT_AND_ACCESS_SETUP`, `PRODUCT_CONFIGURATION`, `DATA_MIGRATION`, `MRA_EIS_SETUP`, `TRAINING_COORDINATION`, `TESTING_AND_ACCEPTANCE`, `GO_LIVE_READINESS`, `GO_LIVE`, `STABILISATION`, `HANDOVER`, `COMPLETION`. `NOT_APPLICABLE` only via approved rules.

### Templates
Versioned; active versions immutable; applicability by type/product/plan/segment/territory; approval lifecycle (`DRAFT`…`ACTIVE`…`RETIRED`). Historical Projects retain exact template version definitions.

### Project creation
Validates Request, handoff, Customer/Tenant/Subscription, product scope, template applicability, owners, duplicates. Materialises Workstreams/Milestones/Tasks/Checklists once. Emits events + audit. Exact retry returns existing Project.

---

## 7. Kick-off, stakeholders, scope

### Kick-off
Proposed/confirmed date, timezone, linked Phase 13 Meeting, agenda, participants, objectives, scope/responsibility confirmation, target dates, risks, questions, decisions, outcome, follow-up tasks, attendance (≠ RSVP), audit.

### Kick-off readiness
Requires valid Customer/Tenant/Subscription, owners, Customer project owner / admin identified, product scope visible, target go-live proposed, specialists/participants as required, agenda approved, no Critical conversion blocker. States: `NOT_READY`, `PARTIALLY_READY`, `READY`, `BLOCKED`, `WAIVED_WITH_APPROVAL`.

### Stakeholders
Customer and Internal role catalogues (project owner, sponsor, Tenant Admin, billing/implementation/technical/migration/MRA/training contacts; CS/Implementation/Technical/Product/Finance/Support/executive). Retain identity, role, org, required/optional, communication eligibility, effective dates, status, audit. Contacts must be verified where required.

### Requirements / scope
Confirm accepted products, plan version, add-ons, quantities, businesses/branches/devices/terminals, MRA/implementation/training/migration/integration scope, responsibilities, dates, exclusions, assumptions. Mismatch → `SCOPE_MISMATCH` / Change Request / commercial or subscription amendment required — no silent Subscription mutation.

---

## 8. Workstreams, milestones, tasks, responsibilities

### Workstreams
Governance, tenant/business/branch/user setup, product/accounting config, migration, MRA EIS, integration, training, testing, go-live, stabilisation, handover — with owner, dates, progress, dependencies, risks/issues, readiness, audit.

### Milestones
Sequence, owners, required/optional, target/actual dates, dependencies, acceptance criteria, evidence, customer/internal approval, waiver, delay reason. Completion source-backed.

### Tasks
Actor types `INTERNAL` | `CUSTOMER` | `SHARED` | `SYSTEM_VERIFICATION`. Dependencies (`FINISH_TO_START`, etc.) block circular/self/cross-project invalid links. Reminders/escalations server-side. Completion requires `completionSource`.

### Customer evidence (admin attestation)
Attach file/note + `attestedBy` / `attestedAt` / `attestationReason` / Contact link → `EVIDENCE_SUBMITTED` → review approve/reject (reason retained). Portal path reserved as `CUSTOMER_PORTAL_NOT_CONFIGURED`.

### Responsibilities
`CUSTOMER` | `INSIGHTBOOKS` | `SHARED` — due dates, evidence, acceptance history. Acceptance ≠ commercial Contract execution.

---

## 9. Readiness coordination (boundaries)

| Area | Onboarding does | Onboarding does not |
|------|-----------------|---------------------|
| Tenant / Business / Branch / User | Evaluate readiness vs accepted scope; track invites/roles/assignments; least-privilege check | Silently repair identity; grant Super Admin; bypass RBAC |
| Product configuration | Expected vs actual vs entitlement; verify evidence | Activate unquoted features / escalate quantities |
| Accounting setup | Requirement checklist + call approved services only | Post OB/stock/journals/AR/AP/tax |
| Migration | Coordinate states, file inventory (private), dry-run/recon gates, Customer sign-off | Replace migration engine; complete on upload alone |
| MRA EIS | Readiness checklist, credential-status boundary, test/production approval refs | Fabricate credentials; Production fiscal submit without approved services |
| Training | Consume Phase 16 training handoff; track readiness / dependency | Mark training complete (Phase 18) |
| Testing / Defects | Plans, cases, results, evidence, severity, retest | Duplicate Support/Product defect systems (typed handoffs OK) |

**Go-live readiness dimensions** include Customer/internal approval, tenant/businesses/branches/users/roles/entitlements/configuration/accounting/migration/training/MRA/integrations/testing/support/billing/backup/rollback/communication/open issues. `UNKNOWN` never treated as `READY`. Critical defects block; High block unless approved exception.

**Go-live execution** records window, participants, pre-flight, confirmations, issues, outcome (`SUCCESSFUL`…`CANCELLED`), rollback decision, Customer acknowledgement. Success → `STABILISATION`, not immediate `COMPLETED`.

**Stabilisation** — daily checks, issue monitoring, exit criteria + approval.

**Handover** — CS / Support / Technical / Billing / Product / MRA / Customer Admin — with open items and acceptance.

**Completion** — required workstreams/milestones/tasks/responsibilities, migration/training/MRA policy, go-live + stabilisation exit, handover, Customer + internal sign-off, reconciliation, no blocking DQ. Immutable completion certificate + checksum; exact retry returns same certificate.

---

## 10. Health, progress, metrics, reliability

### Onboarding health (deterministic, versioned rules)
States: `HEALTHY`, `HEALTHY_WITH_WARNINGS`, `AT_RISK`, `HIGH_RISK`, `BLOCKED`, `UNKNOWN`, `NOT_ENOUGH_DATA`. Dimensions include progress, milestones, tasks, Customer responsiveness/responsibilities, migration, training, technical, MRA, testing, defects, go-live, timeline. **No ML.** Does not overwrite Phase 8 Customer Health; may feed as one input.

### Progress
Weighted required items; exclude `NOT_APPLICABLE`; waived items per policy; never >100%; progress alone ≠ completion. Server-authoritative.

### Reliability gate
Before metrics/readiness claims: handoff/project/customer/tenant/subscription/template/task evidence/migration/training/MRA/go-live/completion/recon/DQ/permission/freshness. Gate fail → typed unavailable state — **never false zero**.

### Data quality / reconciliation / lineage
DQ rules for requests, projects, tasks, milestones, migration, training, go-live, completion. Reconcile handoff ↔ project ↔ tenant scope ↔ migration/training/MRA ↔ go-live ↔ completion. Preserve commercial → handoff → request → project → evidence → certificate lineage.

---

## 11. UI surfaces

- **Overview** — queues (new requests, ready kick-off, in progress, Customer/internal waiting, at risk, blocked, migration/training/MRA/testing, go-live, stabilisation, handover, completion, completed) + reliability bar
- **My Work / Team / Calendar**
- **Queues** — ready, in-progress, at-risk, blocked, go-live, stabilisation, completed, cancelled
- **Requests** — list/new/detail
- **Project detail** — tabs: overview, source, customer, subscription, requirements, kick-off, stakeholders, workstreams, milestones, tasks, customer/internal actions, configuration, users/roles, businesses/branches, migration, MRA, integrations, training, testing, readiness, go-live, stabilisation, handover, risks, issues, decisions, documents, communications, timeline, reconciliation, audit
- **Templates + catalogues** (types, workstream/milestone/task/checklist templates, risk/issue catalogues, readiness/go-live/stabilisation policies)
- **Reports / data quality / reconciliation / audit / settings**

Lists: server pagination/filter/sort, mobile cards, per-record authz. Context Bar: filters + population + watermark + freshness + recon + DQ + permission scope + timezone.

---

## 12. Security, privacy, SoD

Permissions under `systemAdmin.customerSuccess.onboarding*` (view/create/edit/assign/pause/resume/cancel/reopen/complete; requests; templates; kickoff; stakeholders; workstreams/milestones/tasks/evidence/waive; configuration; migration(+sensitive files); mraEis; training handoff; testing; goLive; stabilisation; handover; completion; reports/export/schedule; dataQuality; reconciliation; audit).

Field projections: CS portfolio-scoped; Implementation assigned; Migration/MRA/Training specialists scoped; Finance billing readiness; Support handover/stabilisation; Executive aggregates; Auditor read-only.

SoD: template author≠approver; evidence submitter≠reviewer where required; go-live/completion/waiver/CR commercial approver separation; recon runner≠reviewer.

Documents: classification (`CUSTOMER_SAFE`…`MRA_EIS_SENSITIVE` / `FINANCIAL_SENSITIVE`); private storage; MIME/size/scan; expiring access; download audit; no credentials in general docs/notes; migration files never public URLs.

Cache keys include environment, project/customer/tenant/business/branch/subscription/product/plan/migration/training/MRA/go-live filters, role projection, permission version, watermark, recon version. Never cache migration files, credentials, or Contact PII in broad aggregates.

---

## 13. Wave plan (Approach B + SDD)

| Wave | Deliverables | Stop gate |
|------|--------------|-----------|
| **0** | Forensic audits under `docs/admin-intelligence-crm/phase-17/`; gap register; implementation plan scaffolding; matrices | CONDITIONAL GO |
| **1** | Request/Project models + numbering + state machines + status history; handoff consume; accept/reject/convert; idempotency; permissions skeleton; Vitest | Request/Project truth + no duplicate convert |
| **2** | Templates/versions/approval/applicability; materialisation; stakeholders; kick-off↔Phase 13; tasks/evidence/attestations; dependencies; responsibilities; requirements/scope/CR | No fabricated kick-off/Customer complete; scope mismatch gated |
| **3** | Tenant/biz/branch/user/config readiness; accounting boundary; migration/MRA/training coordination; testing/defects; go-live readiness/approval/execution; stabilisation; handover; completion+certificate | No false go-live/completion; accounting boundary holds |
| **4** | Overview/My Work/queues/detail UI; health/progress/metrics+reliability gate; DQ/recon/lineage; reports/exports/scheduled; search/cache; EN/NY; Phase 8 migrate; Phase 18 input pack; final readiness docs | Exit `READY_FOR_PHASE_18_WITH_BLOCKERS` |

No parallel implementers. Commits only on user request.

---

## 14. Out of scope (Phase 17)

- Complete Customer Training Management (Phase 18)
- Trainer capacity, training certificates/assessments
- Complete data-migration engine reimplementation
- Complete accounting setup wizard reimplementation
- Direct accounting postings
- Complete MRA EIS fiscal implementation / unauthorised Production submission
- Complete Support or Subscription billing reimplementation
- Automatic commercial price changes / subscription amendments / Customer or Tenant merges
- AI-generated plans, decisions, go-live approvals, ML health
- Customer evidence portal (typed `NOT_CONFIGURED`)

---

## 15. Acceptance (phase exit)

Phase 17 exits **`READY_FOR_PHASE_18_WITH_BLOCKERS`** when:

- One canonical Request/Project domain exists; Phase 8 reconciled; Phase 16 handoffs consumed safely
- Request/Project creation idempotent; templates versioned; materialisation once
- Customer evidence attestation governed; no fabricated Customer/Task/Milestone/migration/training/MRA/go-live/completion
- Scope mismatches do not silently alter Subscriptions
- Tenant/Business/Branch isolation + least privilege hold
- Accounting posting boundary holds; System CoA remains removed; Tenant CoA functional
- Go-live → stabilisation → handover → evidence-based completion + checksum certificate
- Reliability gate never invents zeroes; recon/DQ/lineage documented
- EN + Chichewa; mobile from 320px; no Critical/High defects in delivered waves
- Optional gaps (portal, migration engine, Training execution, providers) remain **explicit**
- Phase 18 input package complete

---

## 16. Spec self-review notes

- No TBD placeholders for locked decisions.
- Request vs Project vs Handoff vs Training vs Migration kept distinct throughout.
- Customer portal deferred with stable typed code — not silent skip.
- Wave 0 is documentation/audit only; Wave 1 starts durable models.
- Exit is WITH_BLOCKERS by design given Phase 16 upstream blockers and deferred portal/Training.
