# Lead Conversion & Closed-Won Phase 20 — Design

**Status:** Approved (user review 2026-07-31)  
**Date:** 2026-07-31  
**Authoritative scope:** PRD Phase 20 — Lead Conversion and Closed-Won Workflow (CRM)  
**Surface:** `/insightbooks/crm/conversions` (+ overview, my-work, ready/in-progress/blocked/completed/failed queues, closed-won queue aliases if needed, conversion-rules/approvals/duplicates/exceptions/reconciliation/reports/settings as thin hubs; extend lead/opportunity/proposal/quotation conversion deep-links)  
**Architecture:** Approach 1 — extend existing `CrmConversion*` + `lib/admin/crm/conversions/**` (tree phase-16); no parallel `SalesConversion*` domain  
**Code alias:** Tree `docs/admin-intelligence-crm/phase-16/` Closed-Won Conversion ≡ this PRD Phase 20  
**Docs home:** `docs/admin-intelligence-crm/phase-20/` (forensic + compatibility + Phase 21 pack)  
**Upstream inputs:** Tree phase-14 Demo, phase-15 Commercial, phase-12/16 pipeline close, Phase 3–13 admin foundations; PRD Phases 14–19 concepts via compatibility map  

---

## 1. Purpose

Harden and ratify one authoritative, resumable, idempotent Lead Conversion / Closed-Won plane so a genuinely accepted, approved Opportunity becomes: one Conversion record, verified Platform Customer (or existing link), Contacts, immutable commercial snapshot, governed provisioning/subscription/entitlement **requests**, and one Phase 21 onboarding handoff — without fabricating acceptance, approvals, Customers, Tenants, Subscriptions, entitlements, or onboarding execution, and without deleting or redefining mislabelled CS Onboarding/Training/Adoption code.

---

## 2. Locked decisions

| Topic | Decision |
|-------|----------|
| Existing conversion vs new domain | **A** — harden tree-16 `CrmConversion*`; no second conversion domain |
| Docs / quarantine | **A** — new `phase-20/` pack; CS tree 17–19 stay with `MISLABELLED_PHASE` / `FUTURE_PHASE_SCOPE` banners; no folder renames/deletes |
| Gap depth | **A** — forensic + Critical/High truth/security harden only; optional polish WITH_BLOCKERS |
| Phase 21 handoff | **A** — keep handoff contract; CS onboarding (tree-17) = FUTURE PRD-21 consumer; Phase 20 does not create Onboarding Projects |
| Architecture | **Approach 1** — extend `lib/admin/crm/conversions/**` |
| Sequencing | **Approach B** waves + SDD |
| Exit | Expect **`READY_FOR_PHASE_21_WITH_BLOCKERS`** when optional providers remain explicit |
| Commits | Only when user asks; WORKING_TREE OK; SQL + model guards if Prisma EPERM |

---

## 3. Phase-label correction (authoritative)

| PRD phase | Authoritative content | Tree folder (current) | Action |
|-----------|----------------------|------------------------|--------|
| 14 | CRM Foundation / Lead Capture | Often under earlier CRM phases (e.g. 11) | Document in compatibility map |
| 15 | Qualification | Earlier CRM waves | Document |
| 16 | Pipeline / stages | Tree ~phase-12 | Document |
| 17 | Activities / calendar | Tree ~phase-13 | Document |
| 18 | Demo | Tree **phase-14** | Document mismatch |
| 19 | Proposal / Quotation | Tree **phase-15** | Document mismatch |
| **20** | **Lead Conversion / Closed-Won** | Tree **phase-16** | **This phase — harden + re-home docs to phase-20/** |
| 21 | Customer Onboarding | Tree **phase-17** CS | Quarantine as FUTURE; do not redefine as Phase 20 |
| 22+ | Training / Adoption / … | Tree **phase-18/19** CS | Quarantine; preserve code |

Adoption’s `PHASE_20_INPUTS.md` (CS renewals) is **not** PRD Phase 20 Lead Conversion.

**Do not** delete working CS onboarding/training/adoption code. **Do not** let it redefine Phase 20.

---

## 4. Hard rules

- Lead ≠ CRM Account ≠ Platform Customer ≠ Tenant ≠ Business ≠ Branch.
- Opportunity ≠ Conversion; Closed-Won ≠ Conversion completion; Conversion ≠ Onboarding; Acceptance ≠ Payment ≠ Subscription ACTIVE.
- Provisioning **request** ≠ provisioning **result**; handoff ≠ onboarding Project started; Training/Migration/MRA requirement ≠ completion/activation.
- Exact retries must not duplicate Conversion, Closed-Won transition, snapshot, Customer, Contact links, requests, handoffs, or completion certificates.
- UNKNOWN readiness ≠ READY; expired/superseded commercial versions cannot Closed-Won/convert.
- No fabricated acceptance, authority, approval, Customer, Contact, Tenant, Subscription, entitlement, invitation, handoff, or completion.
- No auto-merge Customers/Contacts; no overwrite verified Customer with weaker CRM data.
- No Tenant GL / opening balances / journals; no billing source-of-truth change; no MRA EIS fiscal submission from conversion.
- No secrets (passwords, payment, MRA credentials) in notes/logs/exports.
- Reliability gate fail → never false zero; System CoA stays removed; Tenant CoA remains functional.
- Sales-team / territory / customer / tenant fail-closed on lists, search, export, metrics, writes-by-id.

---

## 5. Domain architecture

```text
Qualified Lead → CRM Account/Contacts → Opportunity
        → Activities/Demo → Proposal/Quotation
        → Customer Acceptance (+ authority)
        → Internal Closed-Won Approvals
        → Closed-Won Readiness (server)
        → Opportunity CLOSED_WON (idempotent)
        → CrmConversion (CNV-) + immutable Commercial Snapshot
        → Customer/Contact convert or link (duplicate review)
        → Subscription / Entitlement / Tenant / Business / Branch / User REQUESTS
        → Training / Migration / MRA EIS / Integration / CS assignment REQUIREMENTS
        → Phase 21 Onboarding Handoff (one active + checksum)
        → Reconciliation → Completion Certificate
```

**Canonical path:** `lib/admin/crm/conversions/**` (orchestrator, readiness, steps, snapshot, duplicates, provision requests, handoffs, metrics, reliabilityGate, recon, exports, search).

**Reuse:** Pipeline `closeOpportunityWon`; commercial proposals/quotations/acceptance; Platform Customer / Tenant / Subscription / invitation services (typed unavailable when missing).

**Do not duplicate:** CRM Lead/Account/Contact/Opportunity/Proposal/Quotation; Platform Customer/Tenant/Subscription engines; CS Onboarding Project spine (tree-17).

---

## 6. Closed-Won readiness & state

Server readiness evaluates (at minimum): linked Lead/Account/Contacts; Opportunity pre-won stage; Products/quantities; exact accepted Proposal/Quotation version (not expired/revoked/superseded); Customer acceptance + authority; required discounts/approvals; currency/billing/contract/tax/scopes; duplicate Customer/Contact review; no blocking DQ/legal/finance/tech issues.

Readiness states include `NOT_READY`, `PARTIALLY_READY`, `READY`, `READY_WITH_WARNINGS`, `APPROVAL_REQUIRED`, `DUPLICATE_REVIEW_REQUIRED`, `BLOCKED`, `UNKNOWN`, … — **UNKNOWN never passes**.

`CLOSED_WON` transition: authorise → readiness → lock snapshot identity → create/identify one Conversion → emit events → immutable history. No browser-only Closed-Won. Exact retry → same Conversion.

---

## 7. Acceptance, authority, approvals

Acceptance retains exact commercial version, Contact, authority, method, evidence, timestamps — never inferred from email open/view/verbal note/unlinked payment/silence.

Authority: `VERIFIED` / `VERIFICATION_REQUIRED` / `UNKNOWN` (UNKNOWN blocks where policy requires).

Internal approvals (Sales Manager, Commercial, Finance, Legal, Technical, Discount, …) with SoD; superseded commercial versions invalidate non-carried approvals.

---

## 8. Conversion model & saga

Keep `CrmConversion` numbering `CNV-YYYY-######`, status machine, step executions with idempotency keys, optimistic concurrency, resumable orchestration, typed compensation.

Statuses distinguish `IN_PROGRESS`, `PARTIALLY_COMPLETED`, `COMPLETED`, `COMPLETED_WITH_WARNINGS`, `BLOCKED`, `FAILED`, etc. — Closed-Won alone ≠ COMPLETED.

Steps cover source/acceptance/approval validation, snapshot lock, duplicate reviews, Customer/Contact convert/link, requirement/request creation, handoff, reconciliation, completion certificate.

---

## 9. Commercial snapshot

Immutable conversion-time snapshot: accepted versions, products/plan/add-ons/quantities, currency, billing, discounts/taxes, fees, acceptance + approval refs, checksum. Material change → governed amendment + new accepted version + linked amendment conversion — never silent mutate.

---

## 10. Customer / Contact / duplicates

Support `NEW_CUSTOMER`, `EXISTING_CUSTOMER_NEW_SUBSCRIPTION`, `EXISTING_CUSTOMER_EXPANSION`, `EXISTING_CUSTOMER_NEW_BUSINESS_OR_BRANCH`.

Duplicate states: `NO_MATCH` … `EXACT_MATCH` / `MANUAL_REVIEW_REQUIRED` / `LINK_EXISTING` / `CREATE_NEW`. Exact unresolved identity blocks auto-create. No automatic merge.

Contact roles (PRIMARY, BILLING, TECHNICAL, …); consent preserved; no spam/unverified forced conversion; no cross-Customer exposure.

---

## 11. Requests & handoffs (honesty)

Subscription / entitlement / tenant / business / branch / user requests: status remains non-terminal until authoritative service returns. Phase 20 must not mark ACTIVATED / PROVISIONED / PAID without provider result.

Requirement handoffs (Training, Migration, MRA EIS, Integration, CS assignment): scope + contacts + commercial refs only — no secrets; no delivery/completion claims.

**Onboarding handoff:** one active canonical package + checksum + supersession history; pending provisioning labelled pending; states through READY/SENT/ACCEPTED_BY_ONBOARDING/… — consumed by FUTURE PRD-21 (tree CS onboarding), not executed here.

---

## 12. UI, permissions, privacy

Canonical routes under `/insightbooks/crm/conversions`. Thin `/crm/closed-won/*` only as aliases to readiness queues if audit requires. No competing conversion route families.

Permissions: extend existing `systemAdmin.crm.conversions*` / closedWon* catalogues as needed. Field projections for Sales Rep / Manager / Commercial / Finance / Legal / Technical / CS / MRA / Executive / Auditor. SoD on Closed-Won approve, discount, completion, exception, merge.

Exports: PDF/XLSX/CSV with revalidated permission, PII projection, no secrets, formula injection neutralised, en + ny.

---

## 13. Waves (SDD)

| Wave | Deliverable |
|------|-------------|
| 0 | `docs/admin-intelligence-crm/phase-20/` forensic pack: roadmap map, mislabel audit, compatibility map, CURRENT_* conversion audits, gap register, IMPLEMENTATION_PLAN, PHASE_INPUT_VALIDATION → CONDITIONAL GO. Banner CS phase-17/18/19. **No destructive deletes. No Wave 1 code until GO + execution mode chosen.** |
| 1 | Closed-Won readiness / acceptance / authority / approvals harden + Vitest |
| 2 | Conversion create/execute idempotency, snapshot immutability, customer/contact duplicate gates |
| 3 | Request honesty (no fabricated activation) + onboarding handoff checksum/idempotency/supersession |
| 4 | UI queues/metrics/reliability/DQ/recon/exports + Phase 21 inputs pack + exit decision |

**Tests:** `test/systemAdmin.crm.conversionPhase20Wave{1..4}.test.js` (or extend existing conversion wave tests with Phase 20 gap cases).  
**SDD ledger:** `.superpowers/sdd/progress-phase20.md` (`*-p20.md` briefs).

---

## 14. Exit criteria

**Target:** `READY_FOR_PHASE_21_WITH_BLOCKERS`

Must be true:
- Compatibility map documents PRD ↔ tree numbering; CS 17–19 quarantined, not deleted
- One canonical Conversion domain (`CrmConversion*`)
- Closed-Won readiness server-authoritative; UNKNOWN ≠ READY
- Acceptance + authority + approvals block invalid Closed-Won
- Conversion create/execute idempotent and resumable
- Commercial snapshot immutable + checksum
- Customer/Contact duplicates prevented (no auto-merge)
- Requests not fabricated as ACTIVATED/PROVISIONED
- One onboarding handoff path; handoff ≠ Project execution
- Reliability gate never false zero; scopes fail-closed
- Vitest Waves 1–4 green for hardened gaps
- Phase 21 input pack honest about blockers

**Explicit blockers (examples):** optional provision/activation/payment/comms providers typed unavailable; rich scheduled-report polish; full `/closed-won/*` UI surface if deferred as alias; Prisma EPERM → SQL fallback.

---

## 15. Out of scope

- Full Customer Onboarding Project execution (PRD 21 / tree-17)
- Customer Training / Adoption management (tree-18/19)
- Rebuilding Phase 8–10 CS engines; Support; Infrastructure monitoring
- Automatic Tenant accounting setup / OB / journals
- MRA EIS fiscal submission
- AI sales assistant
- Deleting or renumbering CS folders in-place
- Parallel `SalesConversion*` domain

---

## 16. Downstream (Phase 21)

Phase 21 consumes the canonical onboarding handoff (identity, commercial snapshot, contacts, scopes, ownership, dates, success criteria, reliability checksum) and owns onboarding execution — without inventing conversion completion from empty foundations.
