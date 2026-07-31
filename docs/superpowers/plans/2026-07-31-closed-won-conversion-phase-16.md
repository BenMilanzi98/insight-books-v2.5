# Closed-Won Conversion Phase 16 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/insightbooks/crm/conversions` with a durable, resumable, idempotent Closed-Won conversion orchestrator that consumes Phase 15 acceptance evidence, transitions Closed Won early via Phase 12, provisions/links Customer–Tenant–Subscription–Platform Billing through existing services, applies activation policy, and emits CS/onboarding handoffs — without fabricating resources or Tenant accounting side effects.

**Architecture:** Approach B waves. Approach 1 durable step saga under `lib/admin/crm/conversions/*`. Closed Won at start of durable execution; orchestrator reuses existing Tenant/Subscription/Invoice/invitation services; payment/provider gaps are typed unavailable. Wave 0 docs-only stop gate before Wave 1 code.

**Tech Stack:** Next.js App Router, Prisma (+ SQL fallbacks), Vitest, AdminShell, Phase 12 close/transition, Phase 15 commercial acceptance/readiness/handoff, Phase 7–9 Customer/Plan/entitlement foundations, en/ny i18n.

**Spec:** [docs/superpowers/specs/2026-07-31-closed-won-conversion-phase-16-design.md](../specs/2026-07-31-closed-won-conversion-phase-16-design.md)

## Global Constraints

- CRM Account ≠ Platform Customer ≠ Tenant ≠ Business ≠ Branch; Subscription ≠ Entitlement ≠ Platform Invoice ≠ Tenant Invoice.
- Closed Won ≠ Paid ≠ ACTIVE ≠ Onboarding/Training complete; Accepted Quotation ≠ Active Subscription.
- Dry run = zero operational side effects.
- Exact retry → existing result; conflicting idempotency payload → fail visibly.
- Closed Won early in durable execution; failures retain Closed Won; no silent reopen; use Phase 12 transition only.
- Compensation explicit — no blind deletes of active/paid resources or acceptance evidence.
- No Tenant GL/AR/revenue/tax/opening balances; no MRA EIS fiscal/credentials fabrication.
- No auto Customer/Tenant merges; no fabricated PAID/ACTIVE; no AI provisioning.
- Gate fail → never false zero; CoA admin stays removed.
- Commits only when user asks; WORKING_TREE OK; SQL + `hasCrm*Model` guards if Prisma EPERM.

## File map

| Area | Paths |
|------|--------|
| Conversion domain | `lib/admin/crm/conversions/**` (requests, readiness, plan, dryRun, orchestrator, steps, customerMatch, tenantProvision, invitations, subscription, entitlements, billing, activation, handoffs, compensate, resume, metrics, reliabilityGate, dq, recon, reports) |
| Prisma / SQL | `prisma/schema.prisma` + `scripts/sql/crm-conversion-phase16-wave{1,2,3,4}.sql` |
| APIs | `app/api/admin/crm/conversions/**`, `conversion-requests/**` |
| UI | `app/insightbooks/crm/conversions/**` (+ requests/approvals/reports stubs) |
| Integrations | Phase 12 `opportunities/close.js` / `pipeline/transition.js`; Phase 15 `commercial/acceptance.js`, `readiness.js`, `phase16Handoff.js`; existing Tenant/Subscription/billing/invite services |
| Tests | `test/systemAdmin.crm.conversionWave{1..4}.test.js` |
| Wave 0 / exit docs | `docs/admin-intelligence-crm/phase-16/*` |

---

### Task 0: Wave 0 — Forensic audits + matrices + readiness

**Files:** Create `docs/admin-intelligence-crm/phase-16/` audit pack per master prompt §5 (CURRENT_* conversion audits, matrices, gap register, IMPLEMENTATION_PLAN, FINAL_READINESS_DECISION). No application code.

**Interfaces:**
- Consumes: Phase 15 `PHASE_16_INPUTS.md`, `PHASE_16_READINESS_CHECKLIST.md`, design spec locks
- Produces: CONDITIONAL GO / BLOCKED in `FINAL_READINESS_DECISION.md`

- [ ] Validate Phase 15 exit `READY_FOR_PHASE_16_WITH_BLOCKERS` (acceptance, checksum, readiness, handoff creates nothing)
- [ ] Audit Closed-Won, Customer create/duplicate, Tenant/Business/Branch provision, invitations, Subscription/entitlements, Platform billing/invoice/payment, activation, CS/onboarding/training/migration/MRA handoffs, idempotency/recovery — classify with prompt taxonomy
- [ ] Write CURRENT_* + DQ/privacy/security/performance audits (real paths; not empty)
- [ ] Matrices: source, domain, types, steps, customer match, tenant action, subscription, entitlement, billing, activation, handoff, compensation, reliability, security
- [ ] Gap register + IMPLEMENTATION_PLAN (gaps → Waves 1–4) + FINAL_READINESS_DECISION
- [ ] Stop — **no Wave 1 code** until user chooses execution mode after CONDITIONAL GO

---

### Task 1: Wave 1 — Request, readiness, dry-run, plan, orchestrator spine, Closed Won early

**Files:**
- Create: `lib/admin/crm/conversions/` — `catalogue.js`, `numbering.js`, `requests.js`, `readiness.js`, `plan.js`, `dryRun.js`, `orchestrator.js`, `steps.js`, `status.js`, `model.js`, `index.js`
- Create: `scripts/sql/crm-conversion-phase16-wave1.sql` + Prisma for ConversionRequest/Plan/Conversion/Step/Attempt/Failure
- Create: thin APIs/UI under `app/api/admin/crm/conversion-requests/**`, `conversions/**`, `app/insightbooks/crm/conversions/**`
- Wire: Phase 15 handoff → conversion request (idempotent); call `closeOpportunityWon` / Phase 12 transition at durable start
- Test: `test/systemAdmin.crm.conversionWave1.test.js`

**Interfaces:**
- Consumes: `evaluateClosedWonReadiness`, `createClosedWonConversionHandoff`, acceptance evidence, Phase 12 close
- Produces:
  - `createConversionRequest` / `validateConversionRequest` / `approveConversionRequest`
  - `evaluateConversionReadiness` (Phase 16 gate wrapping Phase 15 evidence)
  - `createConversionPlan` / `dryRunConversion` (no side effects)
  - `executeClosedWonConversion({ actorContext, conversionRequestId, conversionPlanVersionId, idempotencyKey })`
  - Step runner with input hash; exact retry returns existing; conflicting hash fails
  - Numbers: `CVR-` / `CVN-` (+ plan version)

- [ ] **Step 1: Write failing Vitest** — request numbering; Phase 15 handoff → CVR idempotent; dry-run does not create Customer/Tenant/Subscription/change Opp; execute Closed Won once via Phase 12; exact retry no duplicate conversion; conflicting retry fails; resume skips completed validate step
- [ ] **Step 2: Run** `npx vitest run test/systemAdmin.crm.conversionWave1.test.js` — expect FAIL
- [ ] **Step 3: Implement** SQL/Prisma + lib + thin API/UI + model guards
- [ ] **Step 4: Re-run Vitest** — PASS; no provision beyond Closed Won + durable step rows; no Tenant GL
- [ ] SDD review gate before Wave 2

---

### Task 2: Wave 2 — Customer match/create-link, Tenant/Business/Branch, invitations

**Files:**
- Create: `customerMatch.js`, `customerProvision.js`, `tenantProvision.js`, `businessBranch.js`, `invitations.js`, `isolation.js`
- Create: `scripts/sql/crm-conversion-phase16-wave2.sql` + Prisma for ConversionResource, match decisions, invitation refs as needed
- Thin APIs/UI for duplicate-review workspace
- Test: `test/systemAdmin.crm.conversionWave2.test.js`

**Interfaces:**
- Produces:
  - `matchPlatformCustomer` → EXACT / HIGH / POSSIBLE / NO_MATCH / CONFLICT
  - `decideCustomerCreateOrLink` / `decideTenantCreateOrLink` (audited)
  - Step handlers: CREATE_OR_LINK_PLATFORM_CUSTOMER, CREATE_OR_LINK_TENANT, BUSINESS/BRANCH, LINK_CONTACTS, CREATE_INITIAL_USER_INVITATIONS
  - Invitation: hash-only token, expiry/revoke/resend; exact retry no duplicate invite
  - Accounting init boundary helper asserting no journal/balance posts

- [ ] **Step 1: Write failing Vitest** — POSSIBLE_MATCH blocks create; exact link no duplicate Customer; Tenant slug unique/reserved; invitation retry no duplicate; accounting boundary (no journal); Cross-Tenant Business create denied
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** via existing Customer/Tenant/invite services where present; typed UNAVAILABLE otherwise
- [ ] **Step 4: Re-run Vitest** — PASS
- [ ] SDD review gate before Wave 3

---

### Task 3: Wave 3 — Subscription, entitlements, billing, payment boundary, activation

**Files:**
- Create: `subscription.js`, `entitlements.js`, `billing.js`, `paymentBoundary.js`, `activation.js`
- Create: `scripts/sql/crm-conversion-phase16-wave3.sql` + Prisma as needed
- Test: `test/systemAdmin.crm.conversionWave3.test.js`

**Interfaces:**
- Produces:
  - CREATE_OR_AMEND_SUBSCRIPTION / PROVISION_ENTITLEMENTS from accepted snapshot (qty ≤ accepted; no hidden entitlements)
  - CREATE_OR_LINK_BILLING_ACCOUNT / CREATE_BILLING_SCHEDULE / CREATE_PLATFORM_INVOICE_IF_REQUIRED (idempotent Invoice)
  - INITIATE_PAYMENT_IF_REQUIRED → existing provider or NOT_CONFIGURED; never fabricate PAID
  - `activateProvisionedSubscription` respecting policy (immediate / after invoice / after payment / service date / manual)
  - Closed Won does not imply Subscription ACTIVE

- [ ] **Step 1: Write failing Vitest** — entitlement qty > accepted rejected; Invoice exact retry same invoice; payment initiation ≠ PAID; activation blocked without payment when policy requires; expansion no duplicate Tenant; no Tenant GL from Invoice
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** reuse platform subscription/billing services + boundaries
- [ ] **Step 4: Re-run Vitest** — PASS
- [ ] SDD review gate before Wave 4

---

### Task 4: Wave 4 — Handoffs, hubs, reports, weighted UI, Phase 17 pack

**Files:**
- Create: `customerSuccess.js`, `onboardingHandoff.js`, `trainingHandoff.js`, `migrationHandoff.js`, `mraEisHandoff.js`, `completion.js`, `reports.js`, `dataQuality.js`, `reconciliation.js`, `metrics.js`, `reliabilityGate.js`
- Modify: `lib/admin/crm/opportunities/commercial.js` — `WEIGHTED_PIPELINE_UI_ENABLED = true` behind honesty helpers (or gated accessor)
- Create: `scripts/sql/crm-conversion-phase16-wave4.sql` as needed
- UI hubs + conversion reports; exit docs: `FINAL_PHASE_16_REPORT.md`, `PHASE_17_INPUTS.md`, `PHASE_17_READINESS_CHECKLIST.md`, `FINAL_READINESS_DECISION.md`
- Test: `test/systemAdmin.crm.conversionWave4.test.js`

**Interfaces:**
- Produces:
  - Assign CS; create onboarding/training/migration/MRA handoffs (idempotent; no full execution)
  - `finalizeConversion` + completion certificate checksum
  - Metrics/reports with reliability gate (no false zero)
  - Weighted pipeline UI unlock with currency/reliability gates
  - Exit readiness (expect `READY_FOR_PHASE_17_WITH_BLOCKERS`)

- [ ] **Step 1: Write failing Vitest** — handoff retry same id; no fabricated onboarding complete; recon fail ≠ 0; weighted UI gated; certificate checksum stable; compensation does not delete acceptance
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** handoffs + hubs + reports + weighted UI gate + Phase 17 pack
- [ ] **Step 4: Re-run Vitest** + regression Phases 12/15 commercial suites touched — PASS
- [ ] Record exit readiness; SDD final review

---

## Plan self-review

| Spec section | Task coverage |
|--------------|---------------|
| Early Closed Won + Phase 12 only | Task 1 |
| Durable saga / idempotency / resume | Task 1 (+ continue 2–4) |
| Customer/Tenant/Business/Branch/invites | Task 2 |
| Subscription/entitlements/billing/payment/activation | Task 3 |
| CS + handoffs + reports + weighted UI + Phase 17 | Task 4 |
| Wave 0 forensic | Task 0 |
| No Tenant GL / no fabricate PAID/ACTIVE / no auto-merge | Global + wave tests |

- Placeholder scan: no TBD blocking execution.
- Commit steps omitted per global constraint.
- Interface names consistent: `executeClosedWonConversion`, `dryRunConversion`, `activateProvisionedSubscription`.
