# Closed-Won Conversion Phase 16 — Design

**Status:** Approved (user review 2026-07-31)  
**Date:** 2026-07-31  
**Surface:** `/insightbooks/crm/conversions` (+ conversion-requests, approvals, reports; customer/subscription/billing provisioning hubs as thin extensions — reuse existing admin domains)  
**Architecture:** Approach 1 — durable step saga under one CRM conversion orchestrator; reuse existing Tenant / Subscription / Platform Invoice / invitation services  
**Upstream exit:** Phase 15 `READY_FOR_PHASE_16_WITH_BLOCKERS` (`docs/admin-intelligence-crm/phase-15/PHASE_16_INPUTS.md`)

---

## 1. Purpose

Deliver one authoritative, resumable, idempotent Closed-Won conversion plane that transforms Phase 15 verified acceptance evidence into Platform Customer, Tenant, Business, Branch, User invitations, Subscription, Entitlements, Platform Billing/Invoice initiation, activation-policy evaluation, Customer Success assignment, and onboarding/training/migration/MRA EIS **handoffs** — without fabricating resources, duplicating identity, bypassing isolation, posting Tenant accounting, or executing full onboarding/training/migration/MRA fiscal flows.

---

## 2. Locked decisions

| Topic | Decision |
|-------|----------|
| Closed Won timing | **Early durable lock** — after readiness + duplicate resolve + conversion lock, transition Closed Won via Phase 12 at start of durable execution; downstream failure → conversion `PARTIALLY_COMPLETED` / `FAILED` with Closed Won retained; no silent reopen |
| Provisioning | **Orchestrator + reuse** existing Tenant / Subscription / Platform Invoice / invitation services; typed `NOT_AVAILABLE` when missing — never fabricate ACTIVE / PAID |
| Payment | **Boundary + existing providers** where connected; else explicit unavailable; initiation ≠ PAID |
| Architecture | **Approach 1** — durable `CrmConversion` + step executions (input hash, attempts, outputs) |
| Sequencing | **Approach B** waves + SDD stop gates |
| Weighted Pipeline UI | Unlock in Wave 4 behind reliability + currency honesty gates (indicative; never Revenue) |
| Exit | Expect **`READY_FOR_PHASE_17_WITH_BLOCKERS`** when optional providers remain explicit |
| Commits | Only when user asks; WORKING_TREE OK; SQL + `hasCrm*Model` guards if Prisma EPERM |

---

## 3. Hard rules

- CRM Account ≠ Platform Customer ≠ Tenant ≠ Business ≠ Branch.
- Subscription ≠ Entitlement ≠ Platform Invoice ≠ Tenant Invoice.
- Closed Won ≠ Payment ≠ Subscription ACTIVE ≠ Onboarding/Training complete.
- Accepted Quotation ≠ Active Subscription.
- Dry run has **zero** operational side effects (no Opp stage change, no Customer/Tenant/Subscription/Invoice/invite/handoff creates).
- Exact retry returns existing Conversion/resources; conflicting idempotency payload fails visibly.
- Compensation is explicit — no blind deletes of active Customers, paid Invoices, or acceptance evidence.
- No Tenant Journals / opening balances / stock / AR / revenue / tax postings from conversion.
- No Production MRA EIS credentials or fiscal submission during conversion.
- No automatic Customer/Tenant merges; similar names ≠ exact match.
- No AI provisioning decisions; no default/shared passwords; no raw invitation tokens stored.
- Metric/report gate fail → never fabricated zero.
- System `/insightbooks/chart-of-accounts` stays removed; Tenant CoA remains functional.

---

## 4. Domain architecture

```text
Phase 15 acceptance (version + checksum + authority) + Closed-Won readiness / handoff
        ↓
CrmConversionRequest (CVR-YYYY-######)
        ↓ dry run (preview only) → approved CrmConversionPlan version
        ↓
CrmConversion (CVN-YYYY-######)  [locked]
        ├── TRANSITION_OPPORTUNITY_CLOSED_WON (Phase 12)  ← early durable
        ├── Customer create-or-link
        ├── Tenant create-or-link + Business/Branch
        ├── Contacts + initial User invitations
        ├── Subscription + Entitlements
        ├── Billing Account / Schedule / Platform Invoice (policy)
        ├── Payment initiation boundary → Activation policy
        ├── Customer Success assignment
        ├── Onboarding / Training / Migration / MRA EIS handoffs
        ├── Customer 360 refresh
        └── Reconciliation + Completion certificate
```

**Canonical orchestrator:** `executeClosedWonConversion({ actorContext, conversionRequestId, conversionPlanVersionId, idempotencyKey })`.

**Reuse:** Phase 12 `closeOpportunityWon` / stage transition; Phase 15 acceptance/readiness/`createClosedWonConversionHandoff`; Phase 7/8 Customer/CS; Phase 9 Plan/entitlement taxonomy; existing Tenant/Subscription/Platform billing/invitation services.

**Do not duplicate:** Tenant Invoice as Platform Invoice; parallel Customer/Tenant admin domains; Opp commercial estimates as accepted pricing; browser-authoritative readiness/activation.

---

## 5. Request, plan, dry run

### Conversion request
Sources include `PHASE_15_ACCEPTANCE_HANDOFF`, manual approved, expansion, partner/reseller, API. Pins Opportunity, accepted Proposal/Quotation versions, Acceptance ID, artifact checksum, pricing snapshot, currency, products/plan/add-ons/quantities, contacts, activation/payment policy preferences.

Statuses include: `DRAFT`, `VALIDATING`, `INFORMATION_REQUIRED`, `DUPLICATE_REVIEW_REQUIRED`, `APPROVAL_REQUIRED`, `READY`, `QUEUED`, `IN_PROGRESS`, `PARTIALLY_COMPLETED`, `FAILED`, `BLOCKED`, `COMPLETED`, `CANCELLED`, `REJECTED`, `SUPERSEDED`, `ARCHIVED`.

### Types
`NEW_CUSTOMER_NEW_TENANT`, existing-customer new subscription / upgrade / add-on / quantity / business / branch, partner/reseller, `MANUAL_APPROVED`, legacy — each defines required steps and create-vs-link actions.

### Plan
Immutable versioned plan with create/link decisions, expected resources/side effects, warnings, exceptions, **plan checksum**. Material change → new plan version + re-approval where required.

### Dry run
Shows create vs link, duplicates, expected Subscription/entitlements/Invoice/activation/invites/handoffs, blockers/warnings. Writes at most an auditable preview record — **no** operational domain creates.

---

## 6. Orchestrator, steps, resume, compensate

### Step durability
Each step: code, input hash, attempt number, status, output refs, error code, retryability, compensation state, actor, audit.

Statuses include: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `COMPLETED_WITH_WARNING`, `RETRY_SCHEDULED`, `FAILED_RETRYABLE`, `FAILED_NON_RETRYABLE`, `BLOCKED`, `COMPENSATING`, `COMPENSATED`, `SKIPPED_NOT_APPLICABLE`, `MANUAL_INTERVENTION_REQUIRED`.

### Concurrency
Block two conversions for the same accepted version; duplicate first Invoice; duplicate initial-admin invite; duplicate onboarding handoff — via uniqueness + row locks + idempotency records.

### Resume
Reauthorise, lock, revalidate evidence and completed outputs, skip completed steps, retry eligible failures, block on conflicts — never start a second Conversion to recover the first.

### Compensate (examples)
Revoke unused invitation; cancel/void eligible unissued/unpaid Platform Invoice; suspend unactivated Subscription; revoke pending entitlements; mark failed-provisioning; release reserved slug. Never delete acceptance evidence, Opportunity history, paid Invoices, or Users with valid activity.

---

## 7. Identity and provisioning

### Customer matching
Evidence: existing Customer ID, CRM Account link, registration/tax IDs, verified domain/email/phone, legal/trading name. States: `EXACT_EXISTING_CUSTOMER`, `HIGH_CONFIDENCE_MATCH`, `POSSIBLE_MATCH`, `NO_MATCH`, `CONFLICT`, `MANUAL_REVIEW_REQUIRED`. No auto-merge on similar names alone.

### Tenant / Business / Branch
Server slug; reserved names blocked; isolation + security baseline; Tenant not ACTIVE before activation prerequisites. Primary Business/Branch only when accepted scope requires. Accounting init may invoke existing Tenant CoA template setup once — no balances/journals/AR/revenue/tax.

### Invitations
High-entropy token; hash stored; expiry/revoke/resend; no plain-text/default passwords; no platform Super Admin for Tenant users.

### Subscription / entitlements
Source = accepted commercial version + pricing snapshot. Closed Won does not imply ACTIVE. Entitlements from Phase 9 Plan/add-on versions; quantity ≤ accepted; no hidden/unquoted features. Expansion amends via new Subscription version.

### Billing / payment / activation
Platform Invoice from accepted snapshot only; idempotent. Payment initiation via existing providers or explicit unavailable. Activation policies enforce Invoice/Payment/service-date/manual prerequisites; idempotent.

### Handoffs
CS assignment (no fabricated health); onboarding / training / migration / MRA EIS handoffs idempotent — execution domains consume later (Phase 17+). No Production migration import; no MRA fiscal.

---

## 8. Waves

| Wave | Focus |
|------|--------|
| 0 | Forensic audits + matrices + gap register + IMPLEMENTATION_PLAN + FINAL_READINESS_DECISION (docs only); stop before Wave 1 code |
| 1 | Conversion request/readiness/dry-run/plan + orchestrator + step durability/idempotency + Closed Won early lock + concurrency |
| 2 | Customer match/create-link + Tenant/Business/Branch + invitations + isolation/security baseline |
| 3 | Subscription/entitlements + billing/invoice/payment boundary + activation policies |
| 4 | CS + onboarding/training/migration/MRA handoffs + hubs/reports/DQ/recon + weighted Pipeline UI unlock + Phase 17 pack |

---

## 9. UI & API sketch

**Hubs:** `/insightbooks/crm/conversions/*` (overview, readiness, queues, my-work, detail tabs), conversion-requests, conversion-approvals/exceptions, conversion-reports. Thin customer/subscription/billing-provisioning overview pages may deep-link to existing admin surfaces.

**Extend:** Opportunity conversion-readiness/conversion/commercial/timeline; Proposal/Quotation acceptance/timeline; Account customer/conversion; Customer 360 / CS onboarding links.

**APIs:** `app/api/admin/crm/conversions/**`, `conversion-requests/**` — server pagination/filter/sort; scope + FLS; honesty envelopes on metrics.

**Early waves:** Thin UI stubs OK; authority in `lib/admin/crm/conversions/*` + Vitest.

---

## 10. Reliability, DQ, reconciliation

Gate before metrics/completion: conversion identity, accepted version + checksum, acceptance validity, Customer/Tenant/Subscription/entitlement/billing sources, step history, recon, DQ, permission, privacy. Failed gate → structured unavailable — **never false zero**.

Reconcile source commercial evidence ↔ provisioned resources ↔ billing/activation ↔ handoffs with variance + remediation paths. Source lineage drill-down from Closed-Won value / Customer / Tenant / Subscription / Invoice / handoff to safe evidence.

---

## 11. Testing & verification (per wave)

Vitest: request/handoff idempotency; dry-run no side effects; Closed Won early + no silent reopen; exact/conflicting retry; resume; Customer possible-match blocks create; Tenant isolation; invitation token security; entitlement quantity cap; Invoice idempotency; payment initiation ≠ PAID; activation prerequisite enforcement; handoff idempotency; no Tenant GL; report honesty; weighted UI gated. SQL fallbacks if Prisma EPERM.

---

## 12. Out of scope (explicit)

- Complete onboarding / training / data-migration / MRA EIS implementation execution
- Production MRA EIS fiscal submission or credential fabrication
- Payment-gateway reimplementation; fabricated Payment
- Tenant opening balances/stock/journals/AR/revenue/tax
- Automatic Customer/Tenant merges
- AI provisioning/billing/onboarding plans
- Sales forecasting / commissions
- Accounting / MRA fiscal behaviour changes; System CoA admin reintroduction

---

## 13. Approval

Conversational design sections §1–§4 **approved** 2026-07-31.  
**This file:** user-reviewed and **approved** 2026-07-31. Next: implementation plan → Wave 0.
